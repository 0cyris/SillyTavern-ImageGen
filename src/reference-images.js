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
};

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
 * avatar, and the combined list is truncated to `max`.
 * @param {{user: boolean, char: boolean}} targets
 * @param {number} max
 * @returns {Promise<Array<{label: string, dataUrl: string}>>}
 */
export async function collectReferenceImages(targets, max) {
    if (max <= 0) {
        return [];
    }

    const context = getContext();
    /** @type {Array<{label: string, url: string}>} */
    const candidates = [];

    if (targets.char) {
        const charUrls = resolveCharacterAvatarUrls(max);
        const charName = context.groupId ? null : context.name2;
        for (const url of charUrls) {
            candidates.push({ label: charName || 'character', url });
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
