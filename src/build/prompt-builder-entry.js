// Bundle entry point - re-exports sillytavern-utils-lib's buildPrompt() so the build script
// (scripts/build-prompt-builder.mjs) has a single, small root to bundle from. Not imported
// directly by the extension; consume the built dist/prompt-builder.js instead.
//
// Imports the specific file directly rather than the package root ('sillytavern-utils-lib',
// which resolves to dist/index.js) - the aggregate index re-exports everything the package
// offers (buildFancyDropdown, buildSortableList, ExtensionSettingsManager, etc), which pulls
// in unrelated tooling (sortablejs, popup/dialog-polyfill code) this bundle has no use for.
export { buildPrompt } from '../../node_modules/sillytavern-utils-lib/dist/prompt-builder.js';
