# CLAUDE.md

Guidance for Claude Code (or any coding agent) working in this repository.

## What this is

A fork of SillyTavern's built-in "Image Generation" extension. It's a plain-JS browser
extension (no framework, no bundler for the extension itself) that gets copied wholesale
into a SillyTavern install at
`SillyTavern/public/scripts/extensions/third-party/SillyTavern-ImageGen/`. See
[README.md](README.md) for the user-facing feature list and
[CHANGELOG.md](CHANGELOG.md) for what's changed since the fork diverged.

Notable fork features beyond the built-in extension: image-prompt generation under a
dedicated Connection Profile (instead of the active chat connection/preset), a real
OpenRouter `/v1/images` backend via a bundled server plugin, persona/character reference
images, and a "Cast" generation mode for group/lineup shots.

## Commands

There is **no build step for the extension itself** — `index.js`, `src/*.js` (except
`src/build/`), `*.html`, `style.css` are consumed as-is by the browser. The one build
step that exists is narrow:

```
npm install
npm run build
```

This bundles `sillytavern-utils-lib`'s `buildPrompt()` (via esbuild, entry point
`src/build/prompt-builder-entry.js`) into `dist/prompt-builder.js`, which **is committed**
so end users still just copy the folder without needing Node. Only rerun this if you
change `src/build/prompt-builder-entry.js`, `scripts/build-prompt-builder.mjs`, or bump
the `sillytavern-utils-lib` version in `package.json` — and commit the regenerated
`dist/prompt-builder.js` alongside the source change. A Gitea Actions workflow
([.gitea/workflows/verify-dist.yml](.gitea/workflows/verify-dist.yml)) rebuilds on every
push/PR and fails the check if the committed `dist/` doesn't match, so a forgotten
rebuild gets caught rather than shipped.

There is no lint config and no automated test suite in this repo. Verification is done
by installing into a real, running SillyTavern instance (copy this directory into
`.../third-party/SillyTavern-ImageGen/`, reload the browser) and exercising the feature
live — see "Verification" below.

## Architecture

- **`index.js`** — the entire extension: slash command registration (`/imagine` and
  friends), settings (`S`, persisted via `extension_settings[MODULE_NAME]`), the
  `generationMode` enum (numeric, append-only — values persist in chat files as
  `generation_type`, never renumber), per-mode prompt templates/trigger words/dimension
  handling, the image-backend dispatch (OpenRouter, ComfyUI, Stable Diffusion WebUI,
  etc.), and UI wiring for `settings.html`/`dropdown.html`.
- **`src/prompt-generation.js`** — builds the message array sent to the LLM that writes
  the image prompt. Two paths: `buildViaLibrary()` for Chat Completion Connection
  Profiles (via `sillytavern-utils-lib`'s `buildPrompt()`, see `dist/prompt-builder.js`)
  resolves the profile's assigned preset in the preset's own prompt order; a text-completion
  or no-profile-preset fallback uses `buildFixedOrderMessages()`/`gatherIngredients()` for
  a simpler fixed sequence. Falls back further to the active chat connection entirely
  (`generateQuietPrompt`, in `index.js`) when no Connection Profile is selected at all —
  none of this file's settings gating applies in that fallback.
- **`src/reference-images.js`** — resolves which avatars (persona/character) are relevant
  to a generation mode and fetches/normalizes them as data URLs, for both the vision
  prompt-generation path and OpenRouter's `input_references` image-model path. Duplicates
  the `generationMode` enum as plain numeric constants (deliberately, to avoid a circular
  import with `index.js` — keep both in sync by hand).
- **`src/settings-migration.js`** — one-time, non-destructive copy of settings from the
  built-in Image Generation extension on first load.
- **`src/openrouter-plugin-client.js`** — client for the bundled server plugin.
- **`server-plugin/`** — a SillyTavern server plugin (`imagegen-openrouter`) that proxies
  OpenRouter's real `/v1/images` API; optional, install separately per the README.
- **`src/build/prompt-builder-entry.js`** + **`scripts/build-prompt-builder.mjs`** — the
  narrow build step described above. The build script rewrites `sillytavern-utils-lib`'s
  relative imports to real SillyTavern host files (`script.js`, `world-info.js`, etc.)
  into **absolute** paths from the web root, since the library's own relative paths are
  computed for its install depth inside some other extension's `node_modules`, not this
  one's. If a future library version imports a host file not in `HOST_MODULE_SUFFIXES`,
  the build fails loudly rather than shipping a broken bundle — add the missing
  suffix/absolute-path pair.

## Conventions

- Comments explain *why*, not *what* — a hidden constraint, a workaround for a specific
  host bug, a non-obvious invariant. Don't add comments that restate the code.
- No test suite exists; don't add one speculatively. Verify by running the extension live
  against a real SillyTavern instance (see below) and describe what you tested.
- `generationMode` values are append-only and persisted in users' chat files
  (`generation_type`) — never renumber or reuse an existing value.
- Git workflow: feature branches + PRs against `master`, opened via the `tea` CLI
  (`tea pr create --base master --head <branch>`). This repo pushes to a Gitea instance
  that auto-mirrors to GitHub — don't configure a GitHub remote directly.

## Verification

There's no CI beyond the `dist/` drift check, so live testing is the only real signal:

1. Copy this directory into a running SillyTavern's
   `public/scripts/extensions/third-party/SillyTavern-ImageGen/`, disable the built-in
   Image Generation extension, reload.
2. Exercise the actual feature — trigger the relevant `/imagine <mode>` slash command (or
   the wand menu / interactive trigger), and where prompt assembly is involved, capture
   the outgoing `/api/backends/chat-completions/generate` (or equivalent) request body to
   confirm the message content is what's expected, not just that it didn't error.
3. Check both a solo chat and a group chat where the feature could plausibly behave
   differently (card/persona/World Info resolution, `{{char}}`/`{{user}}` macros, and
   group-only paths like Cast mode's roster block all have solo/group-specific logic).
