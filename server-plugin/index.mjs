import fetch from 'node-fetch';

const API = 'https://openrouter.ai/api/v1';

/** @type {typeof import('../../src/endpoints/secrets.js').readSecret | null} */
let readSecret = null;
/** @type {typeof import('../../src/endpoints/secrets.js').SECRET_KEYS | null} */
let SECRET_KEYS = null;
let OPENROUTER_HEADERS = { 'HTTP-Referer': 'https://sillytavern.app', 'X-Title': 'SillyTavern' };

async function loadHostModules() {
    try {
        const secrets = await import('../../src/endpoints/secrets.js');
        readSecret = secrets.readSecret;
        SECRET_KEYS = secrets.SECRET_KEYS;
    } catch (error) {
        console.error('[imagegen-openrouter] Could not import src/endpoints/secrets.js - the host ST version may be incompatible.', error);
    }

    try {
        const constants = await import('../../src/constants.js');
        if (constants.OPENROUTER_HEADERS) {
            OPENROUTER_HEADERS = constants.OPENROUTER_HEADERS;
        }
    } catch (error) {
        // Not fatal - fall back to the default headers above.
        console.warn('[imagegen-openrouter] Could not import src/constants.js, using default headers.', error);
    }
}

function getKey(req) {
    if (!readSecret || !SECRET_KEYS) {
        return null;
    }
    return readSecret(req.user.directories, SECRET_KEYS.OPENROUTER);
}

export const info = {
    id: 'imagegen-openrouter',
    name: 'ImageGen OpenRouter Images',
    description: 'Bridges the ImageGen fork extension to the real OpenRouter /v1/images API.',
};

export async function init(router) {
    await loadHostModules();

    router.get('/ping', (_req, res) => {
        return res.json({ ok: true, id: info.id });
    });

    router.get('/models', async (req, res) => {
        try {
            const key = getKey(req);
            const response = await fetch(`${API}/images/models`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...OPENROUTER_HEADERS,
                    ...(key ? { 'Authorization': `Bearer ${key}` } : {}),
                },
            });

            if (!response.ok) {
                console.warn('[imagegen-openrouter] models request failed', response.status, await response.text());
                return res.json([]);
            }

            /** @type {any} */
            const data = await response.json();
            const models = (Array.isArray(data?.data) ? data.data : [])
                .map(m => ({ value: String(m.id), text: String(m.name || m.id) }));

            return res.json(models);
        } catch (error) {
            console.error('[imagegen-openrouter] models error', error);
            return res.json([]);
        }
    });

    router.post('/generate', async (req, res) => {
        try {
            const key = getKey(req);

            if (!key) {
                return res.status(400).json({ error: 'OpenRouter API key not set in SillyTavern.' });
            }

            const { model, prompt, aspect_ratio, background, n, output_format, output_compression, quality, resolution, seed } = req.body ?? {};

            if (!model || !prompt) {
                return res.status(400).json({ error: 'model and prompt are required' });
            }

            /** @type {Record<string, any>} */
            const body = { model, prompt };
            const optionals = { aspect_ratio, background, n, output_format, output_compression, quality, resolution, seed };

            for (const [key2, value] of Object.entries(optionals)) {
                if (value === undefined || value === null || value === '') {
                    continue;
                }
                if (key2 === 'seed' && Number(value) < 0) {
                    continue;
                }
                body[key2] = value;
            }

            const response = await fetch(`${API}/images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...OPENROUTER_HEADERS,
                    'Authorization': `Bearer ${key}`,
                },
                body: JSON.stringify(body),
            });

            const text = await response.text();

            if (!response.ok) {
                console.warn('[imagegen-openrouter] generate failed', response.status, text);
                const status = (response.status === 401 || response.status === 402) ? response.status : 500;
                return res.status(status).json({ error: text.slice(0, 2000) });
            }

            /** @type {any} */
            const data = JSON.parse(text);
            const first = Array.isArray(data?.data) ? data.data[0] : null;

            if (!first?.b64_json) {
                console.warn('[imagegen-openrouter] no image data in response', data);
                return res.status(502).json({ error: 'No image data in OpenRouter response' });
            }

            const mediaType = String(first.media_type || 'image/png');
            const format = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[mediaType]
                ?? (mediaType.split('/')[1] || 'png');

            return res.json({ format, image: first.b64_json, usage: data?.usage ?? null });
        } catch (error) {
            console.error('[imagegen-openrouter] generate error', error);
            return res.status(500).json({ error: String(error?.message ?? error) });
        }
    });
}

export async function exit() {
    // Nothing to clean up.
}
