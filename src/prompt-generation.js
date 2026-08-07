import { getContext } from '../../../../extensions.js';
import { ConnectionManagerRequestService } from '../../../shared.js';
import { collectReferenceImages, getReferenceTargets } from './reference-images.js';

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

    if (settings.prompt_system) {
        messages.push({ role: 'system', content: context.substituteParams(settings.prompt_system) });
    }

    if (settings.prompt_include_card || settings.prompt_include_persona) {
        const fields = context.getCharacterCardFields();

        if (settings.prompt_include_card) {
            const parts = [];
            if (fields.description) parts.push(`Description:\n${fields.description}`);
            if (fields.personality) parts.push(`Personality:\n${fields.personality}`);
            if (fields.scenario) parts.push(`Scenario:\n${fields.scenario}`);
            if (parts.length) {
                messages.push({ role: 'system', content: parts.join('\n\n') });
            }
        }

        if (settings.prompt_include_persona && fields.persona) {
            messages.push({ role: 'system', content: context.substituteParams(`{{user}}'s persona:\n${fields.persona}`) });
        }
    }

    if (settings.prompt_include_wi) {
        try {
            const { worldInfoBefore, worldInfoAfter } = await context.getWorldInfoPrompt(context.chat, 8192, true, undefined);
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
            messages.push({ role, content: `${namePrefix}${context.substituteParams(message.mes ?? '')}` });
        }
    }

    // The image-prompt instruction is always sent as the final USER message, not a system/OOC turn.
    // {{char}}/{{user}}/etc. macros in the template must be resolved here - nothing downstream
    // (ConnectionManagerRequestService.sendRequest / ChatCompletionService) substitutes them.
    const instruction = context.substituteParams(quietPrompt);
    let finalContent = instruction;

    if (allowImages && settings.prompt_reference_enabled) {
        const intrinsic = getReferenceTargets(generationType);
        const targets = {
            user: intrinsic.user && !!settings.prompt_reference_user,
            char: intrinsic.char && !!settings.prompt_reference_char,
        };
        const images = await collectReferenceImages(targets, Number(settings.prompt_reference_max) || 0);

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
