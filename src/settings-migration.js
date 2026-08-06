/**
 * One-time, idempotent copy of settings from the built-in stable-diffusion extension
 * (extension_settings.sd) into this fork's own settings object, so users switching
 * over don't lose their styles/prompt templates/character prompts. Never touches
 * extension_settings.sd.
 * @param {object} extension_settings
 * @param {string} MODULE_NAME
 * @param {Function} saveSettingsDebounced
 */
export function migrateFromBuiltIn(extension_settings, MODULE_NAME, saveSettingsDebounced) {
    const target = extension_settings[MODULE_NAME];

    if (target?.__migrated_from_sd) {
        return;
    }

    const source = extension_settings.sd;

    if (source && Object.keys(source).length > 0 && Object.keys(target).length === 0) {
        Object.assign(target, structuredClone(source));
    }

    target.__migrated_from_sd = true;
    saveSettingsDebounced();
}
