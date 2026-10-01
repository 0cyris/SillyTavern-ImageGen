# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project doesn't use
version tags, so entries are grouped by the date they landed on `master` instead of
per-release version headings.

## 2026-10-01

### Added

- Ten built-in style presets (ink field sketch, digital concept art, 1980s TSR cover art,
  classic RPG oil painting, gritty dark fantasy, graphic novel, soft watercolor, dark
  watercolor & ink, Gothic-Punk, Blanche grimdark). They place the style ahead of the
  scene via the `{prompt}` macro and are added to existing installs once each, without
  overwriting or resurrecting a user's own edits or deletions.

## 2026-08-08

### Added

- Gitea Actions workflow that rebuilds `dist/prompt-builder.js` on every push/PR and
  fails the check if it doesn't match what's committed, so a forgotten `npm run build`
  can't ship silently.

### Changed

- Chat Completion Connection Profiles now resolve the assigned preset's own Prompt
  Manager content (Main Prompt, Post-History Instructions, custom entries, and the
  World Info/character/persona/history/Author's Note/depth-prompt slots) in the preset's
  own order, instead of applying only its sampling settings. This went through two
  hand-rolled reimplementations before landing on `sillytavern-utils-lib`'s maintained
  `buildPrompt()`, bundled at build time to keep installation a plain folder copy.
- `{{char}}`/`{{user}}` and other macros in the roster context block are now resolved
  through SillyTavern's real macro engine with a per-member name override, instead of a
  hand-rolled `{{char}}`/`{{user}}`-only regex.

### Fixed

- World Info scanning crashed on every call (wrong argument shape passed to
  `getWorldInfoPrompt`), silently disabling World Info for prompt generation regardless
  of the setting.
- `{{char}}` resolved to an empty string throughout prompt generation in group chats,
  since SillyTavern only populates `name2` for the duration of a specific member's turn
  inside the group-generation loop and this extension runs outside it.
- A Connection Profile with no Completion Preset assigned silently fell back to raw
  model defaults with no visible warning in the extension itself.
- Running `/imagine` with no character or group chat open (e.g. still on the welcome
  screen) silently built a prompt out of SillyTavern's empty-app placeholder state
  instead of failing - now refuses with a warning.
- A `sillytavern-utils-lib` bug where `messageIndexesBetween.start` silently dropped all
  chat history for any non-zero value - worked around by requesting the full range and
  trimming to the configured history depth afterwards.

## 2026-08-07

### Added

- **Cast generation mode** (`/imagine cast`): a group/lineup portrait of everyone
  currently in the scene, on a plain neutral background. In group chats it's the full
  non-muted roster plus persona, with each member's name and card description injected
  explicitly (SillyTavern only auto-combines group cards when generation mode is Join,
  and most groups default to Swap). Solo GM/narrator chats work too, pulling NPCs from
  chat history instead of a roster, with the narrator itself excluded unless actively
  participating rather than just running the scene.
- LICENSE (AGPLv3).

### Changed

- Rewrote the inherited Danbooru-tag-list prompt templates and "ignore previous
  instructions" framing to natural-language prose suited to modern multimodal models.

### Fixed

- Macros in the final image-prompt instruction were never substituted on the Connection
  Profile path, so models received literal unresolved macro text.

## 2026-08-06

### Added

- Forked SillyTavern's built-in Image Generation extension: image prompts can now be
  generated under a dedicated **Connection Profile**, independent of the active chat's
  API/model/preset, and the prompt instruction is sent as the final **user** message
  instead of a system/OOC turn for better model compliance.
- Real OpenRouter `/v1/images` backend via a bundled server plugin, exposing
  `resolution`, `quality`, `output_format`, `seed`, and `n` (none of which are reachable
  through the built-in `chat/completions`-based OpenRouter image endpoint). Also fixes a
  bug where every OpenRouter image was saved with a hardcoded `.jpg` extension regardless
  of its actual format.
- Persona/character reference images: OpenRouter's `input_references` API can attach
  avatars directly to the image model for visual consistency, and a separate toggle sends
  avatars to the prompt-generation Connection Profile as vision content so it can describe
  real appearance instead of guessing. Which avatars are used is picked automatically by
  generation mode, with group chats pulling from recent speakers.
