import { getContext } from '../../../../extensions.js';
import { ConnectionManagerRequestService } from '../../../shared.js';
import { collectReferenceImages, getReferenceTargets, needsRosterContext, buildRosterContextBlock, isCastMode, resolveActiveCharacterName } from './reference-images.js';

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

// The Chat Completion prompt-order character_id ST always uses for the "global" (non-
// per-character) ordering - the CC prompt manager isn't actually per-character (promptManager
// is initialized with dummyId: 100001 for the 'global' lookup strategy CC presets use). Falls
// back to the last entry in prompt_order if 100001 isn't present, matching the reference
// implementation this is modeled on (sillytavern-utils-lib's buildPrompt, used by zTracker).
const CC_PROMPT_ORDER_CHARACTER_ID = 100001;

// "Extension prompt" identifiers a preset's own prompt_order can reference - populated by
// other active extensions (Summarize, Vectors, Vector Storage's data bank, ChromaDB/Smart
// Context) via context.extensionPrompts. Included for parity with how SillyTavern's own
// Prompt Manager resolves these, in case a preset was built assuming they're present.
const EXTENSION_PROMPT_KEYS = {
    summary: '1_memory',
    authorsNote: '2_floating_prompt',
    vectorsMemory: '3_vectors',
    vectorsDataBank: '4_vectors_data_bank',
    smartContext: 'chromadb',
};

// extension_prompt_roles from script.js (SYSTEM/USER/ASSISTANT), inlined rather than
// imported since it's three stable numeric constants and not worth another import path.
const EXTENSION_PROMPT_ROLE_NAMES = ['system', 'user', 'assistant'];

/**
 * Gathers every "ingredient" a Chat Completion preset's standard prompt-order identifiers
 * can resolve to, each already gated by this extension's own settings toggles so both the
 * order-driven and fixed-order assembly paths respect them identically - an ingredient being
 * empty/absent doubles as "don't produce a message for this identifier".
 * @param {any} context
 * @param {number} generationType
 * @param {any} settings
 * @returns {Promise<object>}
 */
async function gatherIngredients(context, generationType, settings) {
    const ingredients = {
        description: '', personality: '', scenario: '', persona: '', mesExamples: '',
        rosterBlock: null, worldInfoBefore: '', worldInfoAfter: '', historyMessages: [],
        extensionPrompts: {},
    };

    if (settings.prompt_include_card || settings.prompt_include_persona) {
        const fields = context.getCharacterCardFields();

        // Cast mode skips the standard card fields. They describe "the current character",
        // which in a solo GM/narrator-driven chat IS the narrator - its card is typically
        // role/lore text ("frames scenes, voices every NPC...") rather than a physical
        // description, and injecting it was pulling worldbuilding into the image prompt and
        // tempting the LLM to draw the narrator as a person. The roster block (group chats)
        // and chat history already cover who's actually present.
        if (settings.prompt_include_card && !isCastMode(generationType)) {
            ingredients.description = fields.description || '';
            ingredients.personality = fields.personality || '';
            ingredients.scenario = fields.scenario || '';
            ingredients.mesExamples = fields.mesExamples || '';
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
        // Substitution is applied by the caller once these ingredients are consumed, not here.
        ingredients.historyMessages = context.chat
            .filter(m => !m.is_system)
            .slice(-historyDepth)
            .map(message => ({
                role: message.is_user ? 'user' : 'assistant',
                mes: message.mes ?? '',
                namePrefix: context.groupId ? `${message.name}: ` : '',
            }));
    }

    for (const [identifier, extensionKey] of Object.entries(EXTENSION_PROMPT_KEYS)) {
        const prompt = context.extensionPrompts?.[extensionKey];
        if (prompt?.value) {
            ingredients.extensionPrompts[identifier] = {
                role: EXTENSION_PROMPT_ROLE_NAMES[prompt.role] ?? 'system',
                content: prompt.value,
            };
        }
    }

    return ingredients;
}

/**
 * Resolves a Chat Completion prompt-order identifier that maps to live chat/character state
 * (a "marker" in ST's own Prompt Manager terminology) to a {role, content} message, using
 * precomputed ingredients. Returns null if the identifier is a recognized marker with
 * nothing to say (e.g. no persona set), or undefined if the identifier isn't a marker at all
 * (caller should look it up as literal preset content instead).
 * @param {string} identifier
 * @param {object} ingredients
 * @param {(text: string) => string} substitute
 * @returns {{role: string, content: string} | null | undefined}
 */
function resolveMarkerContent(identifier, ingredients, substitute) {
    switch (identifier) {
        case 'worldInfoBefore':
            return ingredients.worldInfoBefore ? { role: 'system', content: ingredients.worldInfoBefore } : null;
        case 'worldInfoAfter':
            return ingredients.worldInfoAfter ? { role: 'system', content: ingredients.worldInfoAfter } : null;
        case 'charDescription':
            return ingredients.description ? { role: 'system', content: `Description:\n${ingredients.description}` } : null;
        case 'charPersonality':
            return ingredients.personality ? { role: 'system', content: `Personality:\n${ingredients.personality}` } : null;
        case 'scenario':
            return ingredients.scenario ? { role: 'system', content: `Scenario:\n${ingredients.scenario}` } : null;
        case 'personaDescription':
            return ingredients.persona ? { role: 'system', content: substitute(`{{user}}'s persona:\n${ingredients.persona}`) } : null;
        case 'dialogueExamples':
            return ingredients.mesExamples ? { role: 'system', content: ingredients.mesExamples } : null;
        case 'summary':
        case 'authorsNote':
        case 'vectorsMemory':
        case 'vectorsDataBank':
        case 'smartContext':
            return ingredients.extensionPrompts[identifier] ?? null;
        default:
            return undefined;
    }
}

function formatHistoryMessage(message, substitute) {
    return { role: message.role, content: `${message.namePrefix}${substitute(message.mes)}` };
}

/**
 * Walks a Chat Completion preset's own prompt_order, resolving each entry to a message:
 * either live chat/character state (see resolveMarkerContent) or the preset's own literal
 * prompt text (Main Prompt, Post-History Instructions, custom entries). This is what gives a
 * profile's assigned preset real effect beyond sampling settings - ChatCompletionService
 * never reads prompts/prompt_order (confirmed in the host's presetToGeneratePayload), so
 * without this, a preset built specifically for image-prompt generation would silently lose
 * everything except its temperature/top_p/etc, even though its own prompt content is often
 * the entire reason a dedicated preset was assigned to the profile in the first place.
 *
 * Modeled on sillytavern-utils-lib's buildPrompt() (used by the zTracker extension) for its
 * chat-completion branch, reimplemented locally rather than taken as a dependency since this
 * extension has no build step - everything here is standard context API, same as the rest of
 * this file. Deliberately narrower in two places: World Info is scanned in dry-run mode (a
 * quiet background call shouldn't tick WI sticky/cooldown/timed-effect state the way a real
 * chat turn does), and Author's Note / character-and-group depth-prompts are not supported -
 * both live outside the ordered walk entirely (position-anchored insertion relative to World
 * Info boundaries or message-count depth, rather than an identifier the order references)
 * and are about roleplay continuity/memory rather than the prompt's own formatting, which is
 * what a preset built for this task actually controls.
 * @param {object} preset
 * @param {object} ingredients
 * @param {(text: string) => string} substitute
 * @returns {Array<{role: string, content: string}>}
 */
function buildOrderDrivenMessages(preset, ingredients, substitute) {
    const messages = [];
    const order = preset.prompt_order.find(o => o.character_id === CC_PROMPT_ORDER_CHARACTER_ID)?.order
        ?? preset.prompt_order[preset.prompt_order.length - 1]?.order;
    if (!Array.isArray(order)) {
        return messages;
    }

    const promptsById = new Map((preset.prompts ?? []).map(p => [p.identifier, p]));
    let rosterBlockInserted = false;

    for (const entry of order) {
        if (entry.enabled === false) {
            continue;
        }

        if (entry.identifier === 'chatHistory') {
            messages.push(...ingredients.historyMessages.map(m => formatHistoryMessage(m, substitute)));
            continue;
        }

        // Not a standard ST identifier - this extension's own "who's actually in this scene"
        // block for multi-character modes, anchored near character info when that identifier
        // exists in the order. See the fallback insertion below for presets that omit it.
        if (entry.identifier === 'charDescription' && ingredients.rosterBlock) {
            messages.push({ role: 'system', content: ingredients.rosterBlock });
            rosterBlockInserted = true;
        }

        const marker = resolveMarkerContent(entry.identifier, ingredients, substitute);
        if (marker !== undefined) {
            if (marker) {
                messages.push(marker);
            }
            continue;
        }

        const prompt = promptsById.get(entry.identifier);
        if (!prompt || prompt.enabled === false || prompt.marker || !prompt.content) {
            continue;
        }
        messages.push({ role: prompt.role || 'system', content: substitute(prompt.content) });
    }

    // A preset that never references 'charDescription' (some minimal/custom presets don't)
    // would otherwise silently drop the roster block - it's not something a preset author
    // could have known to structure around, so make sure it lands somewhere rather than
    // vanishing outright. Placed just before the final instruction is appended by the caller.
    if (ingredients.rosterBlock && !rosterBlockInserted) {
        messages.push({ role: 'system', content: ingredients.rosterBlock });
    }

    return messages;
}

/**
 * Fixed-sequence fallback used when there's no Chat Completion preset to order by (no preset
 * assigned to the profile, or a text-completion profile, whose "preset" is an instruct/
 * context preset with no Prompt Manager concept at all). Same ingredients, same settings-
 * gated inclusion as the order-driven path, just always in this fixed order.
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
        console.debug(`ImageGen: roster context block is ${ingredients.rosterBlock.length} chars`);
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
 * Assembles the message array sent to the dedicated image-prompt connection profile.
 * The *active chat's* prompt-manager entries and jailbreak text are NOT included here -
 * that's the entire point of using a separate profile. If the profile's own assigned Chat
 * Completion preset has its own Prompt Manager entries (Main Prompt, Post-History
 * Instructions, custom entries), those ARE included, positioned exactly where that preset's
 * own prompt_order puts them relative to World Info/card/persona/history - a dedicated
 * preset built for this task is exactly what a Connection Profile is for. Falls back to a
 * fixed sequence when there's no preset to order by (see buildFixedOrderMessages).
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
    // resolve to nothing. Pin an explicit name so every substitution below is reliable.
    const nameOverrides = { name1Override: context.name1, name2Override: resolveActiveCharacterName() };
    const substitute = (text) => context.substituteParams(text, nameOverrides);

    const ingredients = await gatherIngredients(context, generationType, settings);

    // Chat Completion profiles only - a text-completion profile's "preset" is an instruct/
    // context preset with no Prompt Manager entries, a different concept entirely.
    const profile = ConnectionManagerRequestService.getProfile(settings.prompt_profile);
    const preset = profile?.mode === 'cc' && profile.preset
        ? context.getPresetManager?.('openai')?.getCompletionPresetByName(profile.preset)
        : null;

    const bodyMessages = preset && Array.isArray(preset.prompts) && Array.isArray(preset.prompt_order)
        ? buildOrderDrivenMessages(preset, ingredients, substitute)
        : buildFixedOrderMessages(ingredients, substitute);

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
