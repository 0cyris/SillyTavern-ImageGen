import { formatCharacterAvatar, getCharacterAvatar, getUserAvatar, user_avatar } from '../../../../../script.js';
import { getContext } from '../../../../extensions.js';
import { getBase64Async, createThumbnail } from '../../../../utils.js';

const SAFE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SIZE_THRESHOLD = 2 * 1024 * 1024;
const MAX_SIDE = 2048;

// Mirrors the `generationMode` enum in index.js. Duplicated as numeric literals here
// (rather than imported) to avoid a circular import: index.js and src/prompt-generation.js
// both import from this module.
const generationMode = {
    CHARACTER: 0,
    USER: 1,
    SCENARIO: 2,
    RAW_LAST: 3,
    NOW: 4,
    FACE: 5,
    FREE: 6,
    BACKGROUND: 7,
    CHARACTER_MULTIMODAL: 8,
    USER_MULTIMODAL: 9,
    FACE_MULTIMODAL: 10,
    FREE_EXTENDED: 11,
    CAST: 12,
};

// Multi-character modes: prompts that describe more than one person at once, and so
// benefit from an explicit roster block (see buildRosterContextBlock) rather than relying
// on whichever single character's card happens to already be in context.
const ROSTER_CONTEXT_MODES = new Set([generationMode.CAST, generationMode.SCENARIO, generationMode.NOW]);

/**
 * Whether a generation mode should get an explicit "characters in this scene" context block.
 * @param {number} mode generationMode enum value (see index.js)
 * @returns {boolean}
 */
export function needsRosterContext(mode) {
    return ROSTER_CONTEXT_MODES.has(mode);
}

/**
 * Whether a generation mode is the Cast (group lineup) mode.
 * @param {number} mode generationMode enum value (see index.js)
 * @returns {boolean}
 */
export function isCastMode(mode) {
    return mode === generationMode.CAST;
}

/**
 * Which avatars are intrinsically relevant to a generation mode, independent of any
 * reference-image settings. Callers AND this with their own include-user/include-char
 * toggles.
 * @param {number} mode generationMode enum value (see index.js)
 * @returns {{user: boolean, char: boolean}}
 */
export function getReferenceTargets(mode) {
    switch (mode) {
        case generationMode.USER:
        case generationMode.USER_MULTIMODAL:
            return { user: true, char: false };
        case generationMode.CHARACTER:
        case generationMode.FACE:
        case generationMode.CHARACTER_MULTIMODAL:
        case generationMode.FACE_MULTIMODAL:
            return { user: false, char: true };
        case generationMode.SCENARIO:
        case generationMode.NOW:
        case generationMode.RAW_LAST:
        case generationMode.FREE:
        case generationMode.FREE_EXTENDED:
        case generationMode.CAST:
            return { user: true, char: true };
        default:
            return { user: false, char: false };
    }
}

/**
 * URL of the currently selected user persona's avatar.
 * @returns {string}
 */
export function resolveUserAvatarUrl() {
    return getUserAvatar(user_avatar);
}

/**
 * URLs of character avatars relevant to the current chat, most-recent-speaker first.
 * In a solo chat this is always a single-element array. In a group chat it walks the
 * chat history backwards collecting distinct speakers, falling back to a random member
 * when there's no history to look at.
 * @param {number} max Maximum number of avatars to return.
 * @returns {string[]}
 */
export function resolveCharacterAvatarUrls(max) {
    const context = getContext();

    if (!context.groupId) {
        return [getCharacterAvatar(context.characterId)];
    }

    const groupMembers = context.groups.find(x => x.id === context.groupId)?.members;
    const seen = new Set();
    const avatars = [];

    const speakingMessages = context.chat?.filter(x => !x.is_system && !x.is_user) ?? [];
    for (let i = speakingMessages.length - 1; i >= 0 && avatars.length < max; i--) {
        const avatar = speakingMessages[i].original_avatar;
        if (avatar && !seen.has(avatar)) {
            seen.add(avatar);
            avatars.push(avatar);
        }
    }

    if (avatars.length === 0) {
        const randomMemberAvatar = Array.isArray(groupMembers) ? groupMembers[Math.floor(Math.random() * groupMembers.length)] : null;
        if (randomMemberAvatar) {
            avatars.push(randomMemberAvatar);
        }
    }

    return avatars.map(formatCharacterAvatar);
}

/**
 * The full cast, roster-ordered rather than recency-ordered: every group member excluding
 * muted ones, or the single active character in a solo chat. Unlike
 * `resolveCharacterAvatarUrls`, this includes members who haven't spoken yet - appropriate
 * for a "everyone in the scene" shot rather than "who's talking right now".
 * @param {number} max Maximum number of avatars to return.
 * @returns {Array<{name: string, url: string}>}
 */
export function resolveGroupRosterAvatars(max) {
    const context = getContext();

    if (!context.groupId) {
        return [{ name: context.name2, url: getCharacterAvatar(context.characterId) }];
    }

    const group = context.groups.find(x => x.id === context.groupId);
    const members = Array.isArray(group?.members) ? group.members : [];
    const disabledMembers = Array.isArray(group?.disabled_members) ? group.disabled_members : [];

    return members
        .filter(avatar => !disabledMembers.includes(avatar))
        .slice(0, max)
        .map(avatar => ({
            name: context.characters.find(c => c.avatar === avatar)?.name || 'character',
            url: formatCharacterAvatar(avatar),
        }));
}

/**
 * Builds a "Characters in this scene" text block naming every non-muted group member and
 * their full card description, so a multi-character prompt (see needsRosterContext) isn't
 * limited to whichever single member happens to be the current speaker. Group card
 * combining (getCharacterCardFields) only does this when the group's generation_mode is
 * APPEND/APPEND_DISABLED - this covers the default SWAP mode too.
 *
 * {{char}}/{{user}} inside each member's own description are replaced with that member's
 * own name / the persona name - the normal substituteParams() always resolves {{char}} to
 * the *current* speaker, which would be wrong for every other member's self-description.
 *
 * Returns null in solo chats (the existing card/persona blocks already cover the single
 * character) or if the group has no eligible members.
 * @returns {string | null}
 */
export function buildRosterContextBlock() {
    const context = getContext();

    if (!context.groupId) {
        return null;
    }

    const group = context.groups.find(x => x.id === context.groupId);
    const members = Array.isArray(group?.members) ? group.members : [];
    const disabledMembers = Array.isArray(group?.disabled_members) ? group.disabled_members : [];
    const userName = context.name1 || 'the user';

    const entries = members
        .filter(avatar => !disabledMembers.includes(avatar))
        .map(avatar => context.characters.find(c => c.avatar === avatar))
        .filter(Boolean)
        .map(character => {
            const description = (character.description || '(no description)')
                .replace(/\{\{char\}\}/gi, character.name)
                .replace(/\{\{user\}\}/gi, userName);
            return `${character.name}:\n${description}`;
        });

    if (entries.length === 0) {
        return null;
    }

    return `Characters in this scene:\n\n${entries.join('\n\n')}`;
}

/**
 * Fetches a data URL and normalizes it: downsizes if it's over the 2MB threshold, or
 * re-encodes as JPEG if its mime type isn't one of the widely-accepted image types.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchAndNormalize(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not fetch image: ${url}`);
    }

    const blob = await response.blob();
    let dataUrl = await getBase64Async(blob);

    const dataSize = dataUrl.length * 0.75;
    const mimeType = dataUrl?.split(';')?.[0]?.split(':')?.[1];

    if (dataSize > SIZE_THRESHOLD) {
        dataUrl = await createThumbnail(dataUrl, MAX_SIDE, MAX_SIDE);
    } else if (!SAFE_MIME_TYPES.includes(mimeType)) {
        dataUrl = await createThumbnail(dataUrl, null, null);
    }

    return dataUrl;
}

/**
 * Collects reference images (as normalized data URLs) for the requested targets.
 * Individual fetch failures are logged and skipped rather than thrown - a missing avatar
 * must not abort the whole generation. Character avatars are ordered before the user
 * avatar, and the combined list is truncated to `max` - except when `targets.user` is set,
 * in which case one slot is reserved for the persona so it can't be pushed out by a large
 * character list.
 * @param {{user: boolean, char: boolean}} targets
 * @param {number} max
 * @param {number} [mode] generationMode enum value. CAST uses roster order (the full cast,
 *   including members who haven't spoken yet) instead of the default recency order.
 * @returns {Promise<Array<{label: string, dataUrl: string}>>}
 */
export async function collectReferenceImages(targets, max, mode) {
    if (max <= 0) {
        return [];
    }

    const context = getContext();
    /** @type {Array<{label: string, url: string}>} */
    const candidates = [];

    if (targets.char) {
        const charMax = targets.user ? Math.max(max - 1, 0) : max;

        if (mode === generationMode.CAST) {
            for (const member of resolveGroupRosterAvatars(charMax)) {
                candidates.push({ label: member.name, url: member.url });
            }
        } else {
            const charUrls = resolveCharacterAvatarUrls(charMax);
            const charName = context.groupId ? null : context.name2;
            for (const url of charUrls) {
                candidates.push({ label: charName || 'character', url });
            }
        }
    }

    if (targets.user) {
        candidates.push({ label: context.name1 || 'user', url: resolveUserAvatarUrl() });
    }

    const truncated = candidates.slice(0, max);
    const results = [];

    for (const candidate of truncated) {
        try {
            const dataUrl = await fetchAndNormalize(candidate.url);
            results.push({ label: candidate.label, dataUrl });
        } catch (error) {
            console.warn('ImageGen: failed to collect reference image', candidate.url, error);
        }
    }

    return results;
}
