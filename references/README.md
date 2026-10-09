# References

Loose design reference for Sprocket & Sprout. Claude and the agents in
`.claude/agents/` skim this folder for a *sense* of the target look and feel.
Nothing here is a spec, and nothing here gets copied into the game.

| Folder | Put here |
|---|---|
| `notes.md` | What you like and why, in your own words. The most useful file in the folder. |
| `palettes/` | Palette files: Lospec `.hex` exports, palette PNG strips, swatch screenshots. |
| `moodboard/` | Concept art, ComfyUI outputs, color studies, anything that captures the mood. |
| `games/` | Screenshots of games you admire (Stardew Valley, Forager, Sun Haven, …). **Local only, not committed** (see below). |
| `ui/` | Screenshots of menus, inventories and HUDs whose layout you like. **Local only.** |

## What gets committed

The repo is public. Screenshots of other people's games are their copyright, so
`games/` and `ui/` are listed in `.gitignore` and stay on this PC. Notes,
palettes and your own mood boards are committed. If you want a game screenshot
committed anyway, put it in `moodboard/` on purpose.

## How to add something

Drop the file in the right folder, then add one line to `notes.md` saying what
to look at in it ("Stardew spring farm: see how every tile has a tuft or a
flower, no two neighbours identical"). A picture without a note tells Claude
much less than the note alone.
