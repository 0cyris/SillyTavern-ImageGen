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
   model/preset you want writing image prompts — ideally a clean preset with no jailbreak or
   prompt-manager entries that would fight the image instruction.
2. In this extension's settings, under "Prompt Generation", select that profile.
3. Optionally add a system instruction (e.g. *"Output only comma-separated tags, no prose."*)
   and tune history depth / included context.
4. Leave the profile unset to keep the old behavior (prompt written by your active chat connection).

If the Connection Manager extension is disabled, or the selected profile fails, generation
falls back automatically to the chat connection with a warning toast.

## Notes

- If you have `minimal_prompt_processing` off and use a chatty model for prompt generation,
  put "output only comma-separated tags, no prose" in the profile's system instruction — the
  default post-processing strips most punctuation/prose but works best with concise output.
- Including World Info in the prompt-generation context runs an extra dry-run WI scan and can
  be slow; it's off by default.
