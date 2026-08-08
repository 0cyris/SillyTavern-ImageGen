// Bundles sillytavern-utils-lib's buildPrompt() (and its internal, tree-shaken dependency
// graph) into a single self-contained ES module at dist/prompt-builder.js.
//
// The published package's relative imports to real SillyTavern host files (script.js,
// world-info.js, etc.) are computed for *its own* install depth inside some other
// extension's node_modules - e.g. `../../../../../script.js`. Copying that string as-is
// would be wrong here, since this extension's install location has a different nesting
// depth. hostImportRewritePlugin intercepts any import matching a known host file's path
// suffix and rewrites it to an absolute path from the SillyTavern web root (`/script.js`,
// `/scripts/world-info.js`, etc.) instead, which resolves correctly regardless of where
// this extension itself is installed. Everything else (the library's own internal files)
// gets bundled/inlined normally.
//
// If a future version of the library reaches a host file not in HOST_MODULE_SUFFIXES,
// esbuild fails the build with an unresolved-import error rather than silently shipping a
// broken bundle - add the missing suffix/absolute-path pair and rebuild.

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// [path suffix as it appears in the package's relative imports, absolute path from the
// SillyTavern public/ web root]. Verified against a real SillyTavern checkout's actual file
// locations, not guessed from the relative-import depth (which is meaningless once we're
// rewriting it away).
// Order matters: longer/more specific suffixes must come before shorter ones they'd
// otherwise be mistaken for (e.g. SlashCommandEnumValue.js before slash-commands.js).
const HOST_MODULE_SUFFIXES = [
    ['/regex/engine.js', '/scripts/extensions/regex/engine.js'],
    ['/slash-commands/SlashCommandCommonEnumsProvider.js', '/scripts/slash-commands/SlashCommandCommonEnumsProvider.js'],
    ['/slash-commands/SlashCommandEnumValue.js', '/scripts/slash-commands/SlashCommandEnumValue.js'],
    ['/slash-commands.js', '/scripts/slash-commands.js'],
    ['/lib/dialog-polyfill.esm.js', '/lib/dialog-polyfill.esm.js'],
    ['/world-info.js', '/scripts/world-info.js'],
    ['/power-user.js', '/scripts/power-user.js'],
    ['/group-chats.js', '/scripts/group-chats.js'],
    ['/openai.js', '/scripts/openai.js'],
    ['/authors-note.js', '/scripts/authors-note.js'],
    ['/instruct-mode.js', '/scripts/instruct-mode.js'],
    ['/chats.js', '/scripts/chats.js'],
    ['/personas.js', '/scripts/personas.js'],
    ['/utils.js', '/scripts/utils.js'],
    ['/popup.js', '/scripts/popup.js'],
    ['/script.js', '/script.js'],
];

/** @type {import('esbuild').Plugin} */
const hostImportRewritePlugin = {
    name: 'st-host-import-rewrite',
    setup(build) {
        build.onResolve({ filter: /^\.\..*\.js$/ }, (args) => {
            const match = HOST_MODULE_SUFFIXES.find(([suffix]) => args.path.endsWith(suffix));
            if (!match) {
                return null; // not a known host file - let esbuild resolve normally (internal package files)
            }
            return { path: match[1], external: true };
        });
    },
};

await esbuild.build({
    entryPoints: [path.join(projectRoot, 'src/build/prompt-builder-entry.js')],
    outfile: path.join(projectRoot, 'dist/prompt-builder.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: false,
    sourcemap: false,
    plugins: [hostImportRewritePlugin],
    banner: {
        js: '// Built from sillytavern-utils-lib via scripts/build-prompt-builder.mjs - do not edit directly, run `npm run build` after changing the dependency version.',
    },
});

console.log('Built dist/prompt-builder.js');
