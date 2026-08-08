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

/**
 * Assembles the message array sent to the dedicated image-prompt connection profile.
 * The chat preset's prompt-manager entries and jailbreak text are NOT included here -
 * that's the entire point of using a separate profile. Full chat context (card, persona,
 * history) is still included so the LLM knows what scene to describe.
 * @param {string} quietPrompt The instruction text for this generation mode (already formatted by getQuietPrompt)
 * @param {number} generationType The generationMode enum value
 * @param {any} settings Fork settings object (S)
 * @param {boolean} [allowImages] Whether to attach reference images to the final user message.
 *   Must be false for text-completion profiles, which flatten messages to a string.
 * @returns {Promise<Array<{role: string, content: string | Array<any>, name?: string}>>}
 */
export async function buildContextMessages(quietPrompt, generationType, settings, allowImages = false) {
    const context = getContext();
    const messages = [];

    // {{char}} normally resolves from the ambient name2, which SillyTavern only sets for the
    // duration of a specific member's turn inside the group-generation loop - everywhere else
    // in a group chat (including this out-of-band call) it's '', so {{char}} would silently
    // resolve to nothing. Pin an explicit name so every substitution below is reliable.
    const nameOverrides = { name1Override: context.name1, name2Override: resolveActiveCharacterName() };
    const substitute = (text) => context.substituteParams(text, nameOverrides);

    if (settings.prompt_system) {
        messages.push({ role: 'system', content: substitute(settings.prompt_system) });
    }

    if (settings.prompt_include_card || settings.prompt_include_persona) {
        const fields = context.getCharacterCardFields();

        // Cast mode skips the standard card block. It describes "the current character",
        // which in a solo GM/narrator-driven chat IS the narrator - its card is typically
        // role/lore text ("frames scenes, voices every NPC...") rather than a physical
        // description, and injecting it was pulling worldbuilding into the image prompt and
        // tempting the LLM to draw the narrator as a person. The roster block (group chats)
        // and chat history already cover who's actually present.
        if (settings.prompt_include_card && !isCastMode(generationType)) {
            const parts = [];
            if (fields.description) parts.push(`Description:\n${fields.description}`);
            if (fields.personality) parts.push(`Personality:\n${fields.personality}`);
            if (fields.scenario) parts.push(`Scenario:\n${fields.scenario}`);
            if (parts.length) {
                messages.push({ role: 'system', content: parts.join('\n\n') });
            }
        }

        if (settings.prompt_include_persona && fields.persona) {
            messages.push({ role: 'system', content: substitute(`{{user}}'s persona:\n${fields.persona}`) });
        }
    }

    if (needsRosterContext(generationType)) {
        const rosterBlock = buildRosterContextBlock();
        if (rosterBlock) {
            console.debug(`ImageGen: roster context block is ${rosterBlock.length} chars`);
            messages.push({ role: 'system', content: rosterBlock });
        }
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
            const { worldInfoBefore, worldInfoAfter } = await context.getWorldInfoPrompt(flatChat, 8192, true, {});
            const wiText = `${worldInfoBefore ?? ''}${worldInfoAfter ?? ''}`.trim();
            if (wiText) {
                messages.push({ role: 'system', content: wiText });
            }
        } catch (error) {
            console.warn('ImageGen: World Info scan for prompt generation failed', error);
        }
    }

    const historyDepth = Number(settings.prompt_history_depth) || 0;
    if (historyDepth > 0 && Array.isArray(context.chat)) {
        const historyMessages = context.chat.filter(m => !m.is_system).slice(-historyDepth);
        for (const message of historyMessages) {
            const role = message.is_user ? 'user' : 'assistant';
            const namePrefix = context.groupId ? `${message.name}: ` : '';
            messages.push({ role, content: `${namePrefix}${substitute(message.mes ?? '')}` });
        }
    }

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
