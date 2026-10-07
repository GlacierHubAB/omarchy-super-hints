# Super Hints — design spec

A context-aware keybinding recommender for the Omarchy top bar. Hold ❖ Super and
a small panel drops from the top-right corner showing the shortcuts you're most
likely to want right now, ranked by what you use, what fits the focused window,
and what usually comes next.

The reference implementation of every decision below is `mockup/index.html`.
Open it in a browser; hold `` ` `` or CapsLock to stand in for Super.

## Goals

- **Fast.** Ranking plus painting stays under 1 ms. Nothing is fetched on keypress;
  bindings, context and stats are already in memory.
- **Quiet.** Appears only after Super has been held for `delay` (160 ms default),
  so quick combos never flash it.
- **Minimal.** Monospace, theme tokens only, no icons beyond keycaps.
- **Teaches.** Surfaces shortcuts you haven't learned yet; gets out of the way for
  ones you have.
- **Themeable.** Uses only Omarchy's foundational tokens (`foreground`,
  `background`, `accent`, `muted`) from the shell's central `Color` singleton.
  Every stock theme works without per-theme work.

## Surfaces

### Bar widget
- Small `❖` glyph at the far right of the bar, muted.
- While Super is held it lights up (accent) and shows held modifiers: `❖⇧⌃⌥`.
- Click toggles the **pinned panel** (full browsable cheat sheet).

### Panel (live, while holding Super)
- Anchored under the bar, top-right, 350 px wide, scrolls if taller than the screen.
- Header: `<app icon> <app> · <context>` and `ws N · N windows`.
- Rows: keycaps · label · one-line plain-English description · small reason tag.
  - Reason tags: an icon of the current app type when it fits the context
    (terminal, vim, agent, browser, code, notes), `412×` for frequency,
    `next` for sequence, `✓` for learned.
  - Modifiers the user *isn't* holding yet render as dashed keycaps.
  - Top row gets an accent bar on the left.
- Grouped under section headings; the most relevant section comes first.
- Footer hints what each extra modifier unlocks: `+⇧ apps & moving`,
  `+⌃ settings`, `+⌥ fine control`.
- Adding modifiers narrows the list live. Shortcuts that need more modifiers
  than currently held are shown at half score.
- Firing a shortcut while the panel is open flashes its row and re-ranks
  (sequence boost), so chained actions keep guiding.

### Pinned panel (click ❖)
- Shows every shortcut, grouped in configured section order.
- Header gains a ⚙ cog that opens the config file.
- Hovering a row reveals its id (used in config). Esc or click-outside closes.

## Categories

| id           | Heading       | Examples |
|--------------|---------------|----------|
| `move`       | Move & focus  | Jump to window, Move window, Drag window, Jump between tabs |
| `arrange`    | Arrange       | Flip side-by-side / stacked, Change layout, Resize (width/height/little/lot), Resize with mouse, Stretch to full width, Keep window's own size, Remember/Restore width, Gaps, Square single window |
| `window`     | Window        | Close, Full screen, Maximize, Float, Pop out & keep on top, See-through |
| `tabs`       | Tabs          | Stack as tabs, Add to stack, Take out, Next/Previous tab, Go to tab N |
| `workspaces` | Workspaces    | Go to, Send & follow, Send & stay, Next/Previous/Last, Show hidden / Tuck away, Move desktop to other screen |
| `apps`       | Apps          | Terminal, Browser, Editor, Obsidian, Files, Passwords, … |
| `menus`      | Menus         | Omarchy menu, Find an app, Show all shortcuts, Power, Theme, Wallpaper |
| `system`     | System        | Notifications, Do not disturb, Clipboard, Emoji, Capture, Lock, Audio, Bluetooth, Display, Scaling, Stay awake, Calculator, Night light |

Labels and descriptions are written for people who don't know tiling-WM jargon
("Flip side-by-side / stacked", not "Toggle split"). Bindings without a curated
label fall back to Hyprland's own bind description.

## Ranking

```
score = (Wf·frequency + Wc·context + Ws·sequence) × (1 − strength·learned)
        × 0.5 if extra modifiers needed
        + 10 if pinned
```

- **frequency**: half global use count, half use count in the current context,
  both log-normalised.
- **context** (0–1): category fit for the context, overridden per shortcut.
  - Contexts: terminal (split by title: shell / nvim / claude), browser, editor,
    notes, empty workspace.
  - Workspace window count: shortcuts that need another window (focus, swap,
    split, resize, tabs…) drop ×0.1 with one window. Move/arrange get +0.15 with
    3+ windows. On an empty workspace, window operations are hidden entirely.
  - Per-app nudges from config (`apps`), keyed by Hyprland window class.
- **sequence**: short boost after an action (e.g. launching an app → focus / swap /
  split; flip split → resize; stack as tabs → next tab). Fades linearly over 9 s.
- **learned** (0–1, per shortcut): exponential moving average of "fast" presses.
  A press is fast when it fires before `max(fastMs, delay)` after the last
  modifier change, i.e. before the hints would have appeared.
  `learned = learned·0.8 + (fast ? 0.2 : 0)`. Learned rows are dimmed and tagged.
  Optional `hide` drops anything above 0.8.

Weights are normalised, so users can type any numbers.

## Config — `~/.config/omarchy/super-hints.jsonc`

JSONC with plain-language comments, hot-reloaded. Missing keys fall back to
defaults; nested `weights` and `learned` merge key-by-key.

```jsonc
{
  "delay": 160,
  "rows": 10,
  "descriptions": "all",          // all | top | off
  "groupByCategory": true,
  "weights": { "frequency": 0.4, "context": 0.4, "sequence": 0.2 },
  "learned": { "enabled": true, "fastMs": 350, "strength": 0.6, "hide": false },
  "categories": ["move","arrange","window","tabs","workspaces","apps","menus","system"],
  "pin": [],
  "exclude": [],
  "labels": { },                  // "split": { "label": "...", "desc": "..." }
  "apps": { "com.mitchellh.ghostty": { "split": 0.2 } }
}
```

## Plugin architecture

Omarchy shell plugin; the repo root is the plugin folder, installed to
`~/.config/omarchy/plugins/io.github.glacierhubab.super-hints/`:

```
manifest.json          kinds: ["bar-widget"], defaultSection: right
Panel.qml              ❖ button, popup (PopupCard), IPC, config + stats persistence
Ranker.js              ranking engine, pure JS, unit-tested with node
hypr/super-hints.lua   compositor bridge
bridge.sh              opt-in install/uninstall of the bridge line in hyprland.lua
```

Data sources:
- **Bindings**: a curated table in `Ranker.js` mirroring Omarchy's defaults, with
  plain-language labels. Planned: merge `hyprctl binds -j` so user-added binds show
  up with their own descriptions.
- **Context**: `ToplevelManager.activeToplevel` (class + title) and
  `Hyprland.focusedWorkspace` (window count).
- **Stats**: `~/.local/state/omarchy/super-hints/stats.json`, written debounced.

Compositor bridge (`hypr/super-hints.lua`, opt-in via `bridge.sh install`):
1. **Super held**: a non-consuming `ignore_mods` bind on `Super_L`/`Super_R`
   starts a 40 ms `hl.timer` that polls `hl.is_key_down` for the modifiers only.
   It sends `hold "<mods>"` on change and `release` when Super goes up.
2. **Which binding fired**: `hl.bind` is wrapped (loaded before Omarchy's
   defaults) so every SUPER binding sends `combo "<mods>" "<key>"` before it
   runs. Mouse binds are left alone. No raw keyboard events are observed.
3. **Fast-press timing** is measured in the plugin from `hold` to `combo`.

## Distribution

- Public repo: `GlacierHubAB/omarchy-super-hints` (MIT, matching Omarchy).
- One-line install, README with GIF + screenshots across themes.
- Share with the community first; then propose upstream as a first-party
  plugin via PR once it has real users.
