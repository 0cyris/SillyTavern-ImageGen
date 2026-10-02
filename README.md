# SillyTavern-ImageGen

A fork of SillyTavern's built-in Image Generation extension that fixes two design flaws:

1. **The image prompt is written by your active chat connection**, including whatever
   jailbreak/prompt-manager instructions are in your current preset. Those instructions
   fight the "describe this scene as image tags" instruction and OpenRouter models are
   especially sensitive to it. This fork lets you pick a dedicated **Connection Profile**
   for prompt generation, separate from your chat connection, while still including full
   chat context (character card, persona, recent history).
2. **The prompt instruction is sent as a system/OOC turn.** This fork sends it as the final
   **user** message instead, which gets better compliance from most models.

It also replaces the OpenRouter image backend with the real
[`/v1/images`](https://openrouter.ai/docs/api/api-reference/images/generate-an-image) API
(via a bundled server plugin), exposing `resolution`, `quality`, `output_format`, `seed`,
and `n` — none of which are reachable through the built-in `chat/completions`-based
OpenRouter image endpoint. It also fixes a bug where every OpenRouter image was saved with
a hardcoded `.jpg` extension regardless of its actual format.

## Requirements

- **Disable the built-in "Image Generation" extension first.** This fork keeps the same
  slash commands (`/imagine`, etc.) and trigger words; running both at once will double-fire.
- (Optional, for the OpenRouter `/v1/images` backend) A server plugin, described below.

## Installation

1. Copy this directory to `SillyTavern/public/scripts/extensions/third-party/SillyTavern-ImageGen/`.
2. Disable the built-in Image Generation extension in the Extensions panel.
3. Reload SillyTavern. Your existing settings from the built-in extension are copied over
   automatically on first load (one-time, non-destructive — your original settings are untouched).

## Building (only needed if you're modifying prompt generation)

Chat Completion prompt assembly is built on
[`sillytavern-utils-lib`](https://www.npmjs.com/package/sillytavern-utils-lib)'s `buildPrompt()`,
bundled ahead of time into the committed `dist/prompt-builder.js` — end users don't need
Node.js or a build step, just the plain copy-the-folder install above. Only rebuild if you're
changing `src/build/prompt-builder-entry.js` or bumping the library version:

```
npm install
npm run build
```

This regenerates `dist/prompt-builder.js`; commit the result alongside your source change.

## OpenRouter server plugin (optional but recommended for OpenRouter)

Without this plugin, OpenRouter generation falls back to the built-in
`chat/completions`-based endpoint, which only supports `model`, `prompt`, and `aspect_ratio`.

1. In `config.yaml`, set `enableServerPlugins: true` and restart SillyTavern once.
2. Copy `server-plugin/` from this repo to `SillyTavern/plugins/imagegen-openrouter/`
   (the folder name must be `imagegen-openrouter`).
3. Restart SillyTavern again. The console should print
   `1 server plugin(s) are currently loaded`.
4. In the extension's settings, the OpenRouter source panel should no longer show the
   "plugin not loaded" banner.

## Using a Connection Profile for prompt generation

1. Create a Connection Profile (via the Connection Manager extension) pointing at whichever
   model/preset you want writing image prompts.
2. In this extension's settings, under "Prompt Generation", select that profile.
3. Optionally add a system instruction (e.g. *"Output only comma-separated tags, no prose."*)
   and tune history depth / included context.
4. Leave the profile unset to keep the old behavior (prompt written by your active chat connection).

If the Connection Manager extension is disabled, or the selected profile fails, generation
falls back automatically to the chat connection with a warning toast.

**Your *active chat's* preset/jailbreak is never used** — that's the entire reason this
feature exists (see the top of this README). **The profile's own assigned Completion
Preset is different: it's used in full.** If the preset has its own Prompt Manager entries
(Main Prompt, Post-History Instructions, custom entries), those are included. Its standard
slots — World Info before/after, character description/personality, scenario, persona,
chat history — are resolved to the real thing and placed exactly where *that preset's own
prompt order* puts them, not a fixed sequence this extension imposes. Build a preset
specifically for this task (a "Task" preset with its own Main Prompt tuned for image-prompt
generation, its own slot ordering) and assign it to the profile — that's the intended way to
shape output beyond the "System instruction" field above. Sampling settings (temperature,
top_p, penalties, reasoning effort, etc.) apply too. If a preset has extension-prompt slots
wired up (Summarize, Vectors, Vector Storage's data bank, Smart Context/ChromaDB), those are
picked up from whichever of those extensions are active, same as normal chat generation.

Author's Note and character/group depth-prompts are included too, inserted at their
configured depth same as normal chat generation. When there's no preset to order by (no
preset assigned to the profile, or a text-completion profile — whose "preset" is an
instruct/context preset with no Prompt Manager concept at all), generation falls back to a
fixed sequence instead: system instruction, card, persona, World Info, history, instruction.

**If generation isn't picking up your Completion Preset at all** (neither sampling nor
prompt content): a profile's assigned preset is a one-time snapshot of whichever Completion
Preset was selected in the main UI *at the moment you created or last updated the profile*
— it isn't kept in sync. If you didn't have one selected then, or it's been renamed/deleted
since, the profile silently has no preset and generation falls back to raw model defaults.
Fix: select the desired preset in the main UI, then click **Update** on the profile in
Connection Manager. Check the browser console for an `ImageGen:` warning confirming which
case applies.

## Cast mode (`/imagine cast`)

A group/lineup shot: every character currently in the scene, together, on a plain neutral
background — a party portrait or "who's in this story" reference sheet.

- **Group chats**: the cast is every non-muted group member plus your persona. The
  prompt-generation LLM is given each member's name and full card description explicitly
  (not just the current speaker's) — SillyTavern only auto-combines group member cards when
  the group's "Generation Mode" is set to Join/Join (Disabled Included), and most groups
  default to Swap, which this mode doesn't depend on.
- **Solo (GM/narrator) chats work too.** The cast is your persona plus whichever NPCs are
  actively present in the recent conversation. There's no roster to draw from there, so
  their appearance comes from chat history and the prompt instruction rather than a card.
- **The active character is only drawn if they're actually in the scene.** The prompt asks
  the LLM to include the current character only if they're a participant, not if they're
  narrating/gamemastering/voicing NPCs from the outside — so a "Gamemaster"-style card
  driving a solo game is correctly left out of its own group portrait. This is judged by
  the LLM from context (there's no structured "this is a narrator" flag), so an unusually
  written GM card could still slip through.
- Forces a landscape aspect ratio, and isn't prefixed with any single character's
  positive/negative prompt — a lineup shouldn't be tagged with one person's tags.
- The standard character-card block (normally injected for every mode) is skipped for Cast
  specifically — it describes "the current character," which in a GM-driven chat is the
  narrator, and its content tends to be role/lore text rather than a physical description
  that would otherwise leak worldbuilding into the image prompt.

Available from `/imagine cast`, the wand menu ("The Cast"), and interactive triggers like
"send me a picture of the cast/group/party/everyone".

## Reference images (persona / character avatars)

Two independent features send avatars as visual reference. Neither implies the other — you
can enable one, both, or neither, with separate include-checkboxes and limits each:

- **Send avatars as reference images** (OpenRouter source only, under the OpenRouter
  panel). Attaches the persona/character avatar(s) to the image generation request itself
  via OpenRouter's `input_references`, so generated images stay visually consistent with
  the card art. Requires the [server plugin](#openrouter-server-plugin-optional-but-recommended-for-openrouter)
  and a model that declares `input_references` support — a warning appears in settings when
  the selected model doesn't support it.
- **Send avatars to prompt LLM (vision)** (under "Prompt Generation"). Attaches avatars as
  image content parts on the final message sent to the prompt-generation Connection
  Profile, so a vision-capable model can describe the character's actual appearance instead
  of guessing. Works with any image-generation source, since it only affects the text
  prompt. Not supported on text-completion profiles (images are silently skipped with a
  console warning); when no Connection Profile is selected, the first collected image is
  passed to the chat connection's own quiet-generation call instead.

Which avatars are attached is decided automatically by generation mode: `me`/user modes use
the persona avatar, `you`/`face` modes use the character avatar, scene-wide modes (`scene`,
`last`, `cast`, free mode) use both, and `background` uses neither. In group chats, avatars
are normally collected from the most recent distinct speakers — except `cast`, which uses
the full non-muted roster in roster order instead of recency, and always reserves a slot for
the persona so a large group can't crowd it out. All of this is capped at the smaller of the
model's own limit and your configured maximum.

If [Persona-Multi-Avatars](https://github.com/Shin-F/Persona-Multi-Avatars) is installed,
the persona image is the avatar it has bound to the current chat or character (chat binding
first), falling back to the persona's default avatar. Still one persona image per generation.
Bindings are ignored while that extension is disabled.

### Why only OpenRouter?

The reference-image-to-image-model path (`input_references`) is OpenRouter-only for now —
not because other backends couldn't benefit from it, but because OpenRouter is the only
backend this fork talks to through a server plugin it fully owns
(`plugins/imagegen-openrouter`). Every other backend (A1111, ComfyUI, NovelAI, Stability,
Horde, WorkersAI, etc.) goes through SillyTavern's own core server routes (`/api/sd/*`,
`/api/horde/*`, implemented in `src/endpoints/stable-diffusion.js` and
`src/endpoints/horde.js` in the main SillyTavern repo) — routes this extension doesn't
control. Adding a reference-image parameter for those would mean landing changes in
upstream SillyTavern itself, not just this fork. OpenRouter's `/v1/images` API was a much
smaller lift: a net-new API channel with its own bundled plugin, so extending it was
entirely self-contained.

(The other reference-image feature — sending avatars to the *prompt-generation* LLM —
already works with any Connection Profile and any image-generation source, since it never
touches the image backend at all.)

## Notes

- If you have `minimal_prompt_processing` off and use a chatty model for prompt generation,
  put "output only comma-separated tags, no prose" in the profile's system instruction — the
  default post-processing strips most punctuation/prose but works best with concise output.
- Including World Info in the prompt-generation context runs an extra dry-run WI scan and can
  be slow; it's off by default.
