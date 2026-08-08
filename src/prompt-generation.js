import { getContext } from '../../../../extensions.js';
import { ConnectionManagerRequestService } from '../../../shared.js';
import { collectReferenceImages, getReferenceTargets, needsRosterContext, buildRosterContextBlock, resolveActiveCharacterName } from './reference-images.js';
import { buildPrompt } from '../dist/prompt-builder.js';

/**
 * Whether the Connection Manager extension is enabled and a prompt-generation profile is selected.
 * @param {any} settings Fork settings object (S)
 * @returns {boolean}
 */
export function isProfilePromptAvailable(settings) {
    if (!settings.prompt_profile) {
        return false;
    }

    const context = getContext();

    if (context.extensionSettings?.disabledExtensions?.includes('connection-manager')) {
        return false;
    }

    return true;
}

/**
 * Gathers card/persona/World Info/history content for the text-completion fallback path,
 * gated by this extension's own settings toggles - an ingredient being empty/absent doubles
 * as "don't produce a message for it". Chat Completion profiles don't use this at all (see
 * buildViaLibrary); text-completion presets have no Prompt Manager concept to order by, so
 * they get this simpler fixed sequence instead.
 * @param {any} context
 * @param {number} generationType
 * @param {any} settings
 * @returns {Promise<object>}
 */
async function gatherIngredients(context, generationType, settings) {
    const ingredients = {
        description: '', personality: '', scenario: '', persona: '',
        rosterBlock: null, worldInfoBefore: '', worldInfoAfter: '', historyMessages: [],
    };

    if (settings.prompt_include_card || settings.prompt_include_persona) {
        const fields = context.getCharacterCardFields();

        if (settings.prompt_include_card) {
            ingredients.description = fields.description || '';
            ingredients.personality = fields.personality || '';
            ingredients.scenario = fields.scenario || '';
        }

        if (settings.prompt_include_persona && fields.persona) {
            ingredients.persona = fields.persona;
        }
    }

    if (needsRosterContext(generationType)) {
        ingredients.rosterBlock = buildRosterContextBlock();
    }

    if (settings.prompt_include_wi) {
        try {
            // getWorldInfoPrompt/checkWorldInfo want string[], most-recent-first - not the raw
            // context.chat message-object array. Passing objects throws inside WorldInfoBuffer
            // (messages[depth].trim is not a function); passing them in chronological order
            // scans the wrong end of the conversation for {{depth}}-scoped entries.
            const flatChat = context.chat
                .filter(m => !m.is_system)
                .map(m => context.groupId ? `${m.name}: ${m.mes ?? ''}` : (m.mes ?? ''))
                .reverse();
            // isDryRun: true - this is a background utility call, not a real chat turn, so it
            // must not tick WI entries' sticky/cooldown/timed-effect state as a side effect.
            const { worldInfoBefore, worldInfoAfter } = await context.getWorldInfoPrompt(flatChat, 8192, true, {});
            ingredients.worldInfoBefore = worldInfoBefore ?? '';
            ingredients.worldInfoAfter = worldInfoAfter ?? '';
        } catch (error) {
            console.warn('ImageGen: World Info scan for prompt generation failed', error);
        }
    }

    const historyDepth = Number(settings.prompt_history_depth) || 0;
    if (historyDepth > 0 && Array.isArray(context.chat)) {
        ingredients.historyMessages = context.chat
            .filter(m => !m.is_system)
            .slice(-historyDepth)
            .map(message => ({
                role: message.is_user ? 'user' : 'assistant',
                mes: message.mes ?? '',
                namePrefix: context.groupId ? `${message.name}: ` : '',
            }));
    }

    return ingredients;
}

function formatHistoryMessage(message, substitute) {
    return { role: message.role, content: `${message.namePrefix}${substitute(message.mes)}` };
}

/**
 * Fixed-sequence assembly used for text-completion profiles, whose "preset" is an instruct/
 * context preset with no Prompt Manager concept at all - there's no order to walk, so this
 * always produces the same shape: card, persona, roster block, World Info, history.
 * @param {object} ingredients
 * @param {(text: string) => string} substitute
 * @returns {Array<{role: string, content: string}>}
 */
function buildFixedOrderMessages(ingredients, substitute) {
    const messages = [];

    if (ingredients.description || ingredients.personality || ingredients.scenario) {
        const parts = [];
        if (ingredients.description) parts.push(`Description:\n${ingredients.description}`);
        if (ingredients.personality) parts.push(`Personality:\n${ingredients.personality}`);
        if (ingredients.scenario) parts.push(`Scenario:\n${ingredients.scenario}`);
        messages.push({ role: 'system', content: parts.join('\n\n') });
    }

    if (ingredients.persona) {
        messages.push({ role: 'system', content: substitute(`{{user}}'s persona:\n${ingredients.persona}`) });
    }

    if (ingredients.rosterBlock) {
        messages.push({ role: 'system', content: ingredients.rosterBlock });
    }

    const wiText = `${ingredients.worldInfoBefore}${ingredients.worldInfoAfter}`.trim();
    if (wiText) {
        messages.push({ role: 'system', content: wiText });
    }

    messages.push(...ingredients.historyMessages.map(m => formatHistoryMessage(m, substitute)));

    return messages;
}

/**
 * Assembles the message body for a Chat Completion profile via sillytavern-utils-lib's
 * buildPrompt() (bundled at dist/prompt-builder.js - see scripts/build-prompt-builder.mjs).
 * Used whether or not the profile has an assigned preset: buildPrompt's own internal
 * fallback (no presetName) calls ST's real prepareOpenAIMessages, so both cases go through
 * the same maintained implementation rather than a hand-rolled approximation of either.
 *
 * ignoreCharacterFields is deliberately never used here, even for Cast mode - the library
 * couples "skip the character card" and "skip the persona" into one flag with no way to
 * keep persona while dropping card, which Cast mode's narrator-exclusion previously relied
 * on. Cast mode instead leans entirely on its own template instruction ("only include
 * {{char}} if an active participant in the scene, not narrating it").
 * @param {string} presetName Profile's assigned preset name, or '' / undefined for none.
 * @param {number} generationType
 * @param {any} settings
 * @param {any} context
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
async function buildViaLibrary(presetName, generationType, settings, context) {
    const historyDepth = Number(settings.prompt_history_depth) || 0;

    // messageIndexesBetween looks like the documented way to emulate prompt_history_depth,
    // but any non-zero `start` silently drops chat history from the result entirely
    // (confirmed live: {start:20,end:24} against a 25-message chat returns 8 messages, all
    // role "system", zero history) regardless of `end` - a bug in the library itself, not a
    // usage error (the full-range/omitted case works correctly). Ask for everything instead
    // and trim afterwards.
    const { result, warnings } = await buildPrompt('openai', {
        presetName: presetName || undefined,
        maxContext: 'preset',
        includeNames: !!context.groupId,
        ignoreCharacterFields: !(settings.prompt_include_card || settings.prompt_include_persona),
        ignoreWorldInfo: !settings.prompt_include_wi,
    });

    for (const warning of warnings ?? []) {
        console.warn('ImageGen:', warning);
    }

    // Entries built from an actual chat message carry `source` (the original message
    // object); everything else (main/jailbreak/persona/WI/etc. prompt-manager entries) does
    // not. That's a reliable way to identify "history" post hoc and trim it to the last
    // historyDepth messages, since messageIndexesBetween can't be trusted to do it up front.
    const totalHistory = result.reduce((n, m) => n + (m.source ? 1 : 0), 0);
    let historySeen = 0;
    const trimmed = result.filter((m) => {
        if (!m.source) {
            return true;
        }
        historySeen += 1;
        return totalHistory - historySeen < historyDepth;
    });

    const messages = trimmed.map(m => ({ role: m.role, content: m.content }));

    if (needsRosterContext(generationType)) {
        const rosterBlock = buildRosterContextBlock();
        if (rosterBlock) {
            // buildPrompt's output carries no per-message identifier to anchor on (unlike
            // the hand-rolled version this replaced) - insert right after the first message
            // (typically Main Prompt) rather than trying to locate "near character info".
            messages.splice(Math.min(1, messages.length), 0, { role: 'system', content: rosterBlock });
        }
    }

    return messages;
}

/**
 * Assembles the message array sent to the dedicated image-prompt connection profile.
 * The *active chat's* prompt-manager entries and jailbreak text are NOT included here -
 * that's the entire point of using a separate profile. For a Chat Completion profile, the
 * *profile's own* assigned preset is used in full (see buildViaLibrary) - a dedicated preset
 * built for this task is exactly what a Connection Profile is for. Text-completion profiles
 * get a simpler fixed sequence instead (see buildFixedOrderMessages).
 * @param {string} quietPrompt The instruction text for this generation mode (already formatted by getQuietPrompt)
 * @param {number} generationType The generationMode enum value
 * @param {any} settings Fork settings object (S)
 * @param {boolean} [allowImages] Whether to attach reference images to the final user message.
 *   Must be false for text-completion profiles, which flatten messages to a string.
 * @returns {Promise<Array<{role: string, content: string | Array<any>, name?: string}>>}
 */
export async function buildContextMessages(quietPrompt, generationType, settings, allowImages = false) {
    const context = getContext();

    // {{char}} normally resolves from the ambient name2, which SillyTavern only sets for the
    // duration of a specific member's turn inside the group-generation loop - everywhere else
    // in a group chat (including this out-of-band call) it's '', so {{char}} would silently
    // resolve to nothing. Pin an explicit name so every substitution below (our own content -
    // not what buildPrompt resolves internally for a preset's own entries) is reliable.
    const nameOverrides = { name1Override: context.name1, name2Override: resolveActiveCharacterName() };
    const substitute = (text) => context.substituteParams(text, nameOverrides);

    const profile = ConnectionManagerRequestService.getProfile(settings.prompt_profile);
    const isChatCompletion = profile?.mode === 'cc';

    const bodyMessages = isChatCompletion
        ? await buildViaLibrary(profile.preset, generationType, settings, context)
        : buildFixedOrderMessages(await gatherIngredients(context, generationType, settings), substitute);

    const messages = [];

    if (settings.prompt_system) {
        messages.push({ role: 'system', content: substitute(settings.prompt_system) });
    }

    messages.push(...bodyMessages);

    // The image-prompt instruction is always sent as the final USER message, not a system/OOC turn.
    // {{char}}/{{user}}/etc. macros in the template must be resolved here - nothing downstream
    // (ConnectionManagerRequestService.sendRequest / ChatCompletionService) substitutes them.
    const instruction = substitute(quietPrompt);
    let finalContent = instruction;

    if (allowImages && settings.prompt_reference_enabled) {
        const intrinsic = getReferenceTargets(generationType);
        const targets = {
            user: intrinsic.user && !!settings.prompt_reference_user,
            char: intrinsic.char && !!settings.prompt_reference_char,
        };
        const images = await collectReferenceImages(targets, Number(settings.prompt_reference_max) || 0, generationType);

        if (images.length > 0) {
            finalContent = [
                { type: 'text', text: instruction },
                ...images.flatMap(img => ([
                    { type: 'text', text: `Reference image — ${img.label}:` },
                    { type: 'image_url', image_url: { url: img.dataUrl } },
                ])),
            ];
        }
    }

    messages.push({ role: 'user', content: finalContent });

    return messages;
}

/**
 * Generates the image prompt using a dedicated Connection Profile instead of the active chat connection.
 * @param {string} quietPrompt The instruction text for this generation mode
 * @param {number} generationType The generationMode enum value
 * @param {any} settings Fork settings object (S)
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>} Raw reply text (not yet passed through processReply)
 */
export async function generatePromptViaProfile(quietPrompt, generationType, settings, signal) {
    const profileId = settings.prompt_profile;
    const profile = ConnectionManagerRequestService.getProfile(profileId);
    const apiMap = ConnectionManagerRequestService.validateProfile(profile);
    const isTextCompletion = apiMap.selected === 'textgenerationwebui';

    if (isTextCompletion && settings.prompt_reference_enabled) {
        console.warn('ImageGen: reference images are not supported on text-completion Connection Profiles, skipping.');
    }

    // profile.preset is a one-time snapshot of whatever Completion Preset happened to be
    // selected in the main UI when the profile was created/updated - it's not kept in sync, so
    // it can end up empty (no preset was selected then, or it's excluded via the profile's own
    // exclude list) and generation quietly falls back to raw model defaults. (If a preset IS
    // assigned but has since been renamed/deleted, ChatCompletionService.processRequest already
    // warns "Preset ... not found" on its own - this only covers the empty case.)
    if (!profile?.preset) {
        console.warn('ImageGen: Connection Profile has no Completion Preset assigned - generating with model defaults only. Select the desired preset in the main UI, then click Update on the profile in Connection Manager.');
    }

    const messages = await buildContextMessages(quietPrompt, generationType, settings, !isTextCompletion);

    // sendRequest passes `prompt` straight through for text-completion profiles - it does not
    // accept a message array there, so it must be pre-flattened via constructPrompt.
    const payload = isTextCompletion
        ? ConnectionManagerRequestService.constructPrompt(messages, profileId)
        : messages;

    const result = await ConnectionManagerRequestService.sendRequest(
        profileId,
        payload,
        Number(settings.prompt_max_tokens) || 256,
        {
            stream: false,
            signal: signal ?? null,
            extractData: true,
            includePreset: true,
            includeInstruct: true,
        },
    );

    return String(result?.content ?? '');
}
