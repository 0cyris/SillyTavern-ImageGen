export const PLUGIN_BASE = '/api/plugins/imagegen-openrouter';

let pluginAvailable = null;

/**
 * Detects whether the bundled imagegen-openrouter server plugin is installed and loaded.
 * Call once at extension init; the result is cached for isPluginAvailable().
 * @param {Function} getRequestHeaders
 * @returns {Promise<boolean>}
 */
export async function checkPlugin(getRequestHeaders) {
    try {
        const response = await fetch(`${PLUGIN_BASE}/ping`, {
            method: 'GET',
            headers: getRequestHeaders({ omitContentType: true }),
        });
        pluginAvailable = response.ok;
    } catch (error) {
        pluginAvailable = false;
    }

    return pluginAvailable;
}

/**
 * @returns {boolean} Whether checkPlugin() previously succeeded. Returns false until checkPlugin() has run.
 */
export function isPluginAvailable() {
    return pluginAvailable === true;
}
