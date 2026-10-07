.pragma library
// Super Hints ranking engine. Pure functions, no QML dependencies, so the same
// logic can be unit-tested with node and stays identical to mockup/index.html.

var CATS = {
  move: "Move & focus", arrange: "Arrange", window: "Window", tabs: "Tabs",
  workspaces: "Workspaces", apps: "Apps", menus: "Menus", system: "System"
}

var MOD_ORDER = ["super", "shift", "ctrl", "alt"]
var ARW = ["left", "right", "up", "down"]
var LR = ["left", "right"]
var DIG = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
var DIG5 = DIG.slice(0, 5)

// [id, mods, keycaps, xkb keys (lowercase), label, description, category, seed uses, seed learned]
var RAW = [
  // move & focus
  ["focus",   "super",           ["←→↑↓"], ARW,               "Jump to window",            "Focus the window on that side",                    "move", 522, .85],
  ["swap",    "super shift",     ["←→↑↓"], ARW,               "Move window",               "Swap places with the window on that side",         "move", 109, .3],
  ["drag",    "super",           ["drag"], [],                "Drag window",               "Hold ❖ and drag with the mouse to move it",        "move", 140, .6],
  ["tabjump", "super ctrl",      ["←→"],   LR,                "Jump between tabs",         "Focus the tab on that side of a stack",            "move", 8,   0],
  // arrange
  ["split",   "super",           ["J"],    ["j"],             "Flip side-by-side / stacked","Two windows next to each other, or one above the other","arrange", 88, .2],
  ["layout",  "super",           ["L"],    ["l"],             "Change layout",             "Switch how windows are arranged on this workspace","arrange", 17, 0],
  ["resize",  "super",           ["−","="],["minus","equal"], "Resize width",              "Make the window narrower or wider",                "arrange", 38, .1],
  ["resizeV", "super shift",     ["−","="],["minus","equal"], "Resize height",             "Make the window shorter or taller",                "arrange", 14, 0],
  ["resizeS", "super alt",       ["−","="],["minus","equal"], "Resize a little",           "Fine-tune the size in small steps",                "arrange", 9,  0],
  ["resizeL", "super ctrl",      ["−","="],["minus","equal"], "Resize a lot",              "Change the size in big jumps",                     "arrange", 7,  0],
  ["rdrag",   "super",           ["right-drag"], [],          "Resize with mouse",         "Hold ❖ and right-drag a window edge",              "arrange", 60, .4],
  ["wfull",   "super alt",       ["F"],    ["f"],             "Stretch to full width",     "Window spans the screen side to side",             "arrange", 26, 0],
  ["pseudo",  "super",           ["P"],    ["p"],             "Keep window's own size",    "Stays in the grid but keeps its preferred size",   "arrange", 6,  0],
  ["savew",   "super alt",       ["Home"], ["home"],          "Remember this width",       "Save the window's width to restore later",         "arrange", 4,  0],
  ["restw",   "super",           ["Home"], ["home"],          "Restore saved width",       "Go back to the width you saved",                   "arrange", 5,  0],
  ["gaps",    "super shift",     ["Bksp"],    ["backspace"],     "Show / hide gaps",          "Space between windows on or off",                  "arrange", 8,  0],
  ["square",  "super ctrl",      ["Bksp"],    ["backspace"],     "Square single window",      "A lone window keeps a square shape instead of stretching","arrange", 3, 0],
  // window
  ["close",   "super",           ["W"],    ["w"],             "Close window",              "Close the window you're in",                       "window", 381, .85],
  ["full",    "super",           ["F"],    ["f"],             "Full screen",               "Fill the whole screen, press again to go back",    "window", 148, .5],
  ["tfull",   "super ctrl",      ["F"],    ["f"],             "Maximize",                  "Take up the whole workspace, keep the top bar",    "window", 19,  0],
  ["float",   "super",           ["T"],    ["t"],             "Float window",              "Free it from the grid so you can drag it around",  "window", 71,  .2],
  ["pop",     "super",           ["O"],    ["o"],             "Pop out & keep on top",     "Small floating window that stays visible",         "window", 31,  0],
  ["opacity", "super",           ["Bksp"],    ["backspace"],     "See-through window",        "Turn transparency on or off",                      "window", 12,  0],
  // tabs
  ["group",   "super",           ["G"],    ["g"],             "Stack as tabs",             "Combine windows into one tabbed window",           "tabs", 14, 0],
  ["intotab", "super alt",       ["←→↑↓"], ARW,               "Add to tab stack",          "Merge this window into the stack on that side",    "tabs", 5,  0],
  ["ungroup", "super alt",       ["G"],    ["g"],             "Take out of tabs",          "Pull this window out of its stack",                "tabs", 6,  0],
  ["tabnext", "super alt",       ["⇥"],    ["tab"],           "Next tab",                  "Cycle through the tabs in a stack",                "tabs", 11, 0],
  ["tabprev", "super shift alt", ["⇥"],    ["tab"],           "Previous tab",              "Cycle backwards through the tabs",                 "tabs", 4,  0],
  ["tabn",    "super alt",       ["1‥5"],  DIG5,              "Go to tab number",          "Jump straight to a tab in the stack",              "tabs", 3,  0],
  // workspaces
  ["ws",      "super",           ["1‥9"],  DIG,               "Go to workspace",           "Switch to another desktop",                        "workspaces", 903, .9],
  ["mvws",    "super shift",     ["1‥9"],  DIG,               "Send window & follow",      "Move this window to a desktop and go there",       "workspaces", 158, .4],
  ["mvsil",   "super shift alt", ["1‥9"],  DIG,               "Send window, stay here",    "Move this window to a desktop without leaving",    "workspaces", 33,  0],
  ["nextws",  "super",           ["⇥"],    ["tab"],           "Next workspace",            "Cycle forward through desktops",                   "workspaces", 61,  .2],
  ["prevws",  "super shift",     ["⇥"],    ["tab"],           "Previous workspace",        "Cycle backward through desktops",                  "workspaces", 27,  0],
  ["former",  "super ctrl",      ["⇥"],    ["tab"],           "Back to last workspace",    "Jump to the desktop you were just on",             "workspaces", 44,  0],
  ["scratch", "super",           ["S"],    ["s"],             "Show hidden window",        "Bring back the window you tucked away",            "workspaces", 47,  .2],
  ["toscr",   "super alt",       ["S"],    ["s"],             "Tuck window away",          "Hide it for later, ❖ S brings it back",            "workspaces", 19,  0],
  ["mvmon",   "super shift alt", ["←→↑↓"], ARW,               "Move desktop to other screen","Send this whole workspace to another monitor",   "workspaces", 11,  0],
  // apps
  ["term",    "super",           ["Enter"],    ["return"],        "New terminal",              "Open another terminal window",                     "apps", 412, .9],
  ["browser", "super shift",     ["B"],    ["b"],             "Open browser",              "New browser window",                               "apps", 184, .6],
  ["editor",  "super shift",     ["N"],    ["n"],             "Open code editor",          "Launch your editor",                               "apps", 96,  .3],
  ["notes",   "super shift",     ["O"],    ["o"],             "Open Obsidian",             "Your notes",                                       "apps", 58,  .2],
  ["files",   "super shift",     ["F"],    ["f"],             "Open file manager",         "Browse your files",                                "apps", 41,  0],
  ["pass",    "super shift",     ["/"],    ["slash"],         "Open password manager",     "Look up or fill a password",                       "apps", 52,  .1],
  ["music",   "super shift",     ["M"],    ["m"],             "Open music",                "Play or control music",                            "apps", 29,  0],
  ["signal",  "super shift",     ["G"],    ["g"],             "Open Signal",               "Messages",                                         "apps", 24,  0],
  ["email",   "super shift",     ["E"],    ["e"],             "Open email",                "Your inbox",                                       "apps", 18,  0],
  ["chatgpt", "super shift",     ["A"],    ["a"],             "Open ChatGPT",              "AI chat in a web app",                             "apps", 15,  0],
  ["docker",  "super shift",     ["D"],    ["d"],             "Open Docker",               "Manage containers",                                "apps", 12,  0],
  ["tmux",    "super alt",       ["Enter"],    ["return"],        "New tmux terminal",         "Terminal that keeps sessions alive",               "apps", 22,  0],
  // menus
  ["launch",  "super",           ["Space"],    ["space"],         "Omarchy menu",              "Apps, settings and system, all in one place",      "menus", 296, .8],
  ["apps",    "super alt",       ["Space"],    ["space"],         "Find an app",               "Search and launch any app",                        "menus", 64,  0],
  ["keys",    "super",           ["K"],    ["k"],             "Show all shortcuts",        "Full list of key combos",                          "menus", 15,  0],
  ["sysmenu", "super",           ["Esc"],  ["escape"],        "Power options",             "Lock, log out, restart or shut down",              "menus", 21,  0],
  ["themes",  "super ctrl shift",["Space"],    ["space"],         "Change theme",              "Switch the look of your desktop",                  "menus", 9,   0],
  ["bg",      "super ctrl",      ["Space"],    ["space"],         "Change wallpaper",          "Pick the next background",                         "menus", 13,  0],
  // system
  ["notif",   "super",           [","],    ["comma"],         "Clear notification",        "Dismiss the latest notification",                  "system", 83, .3],
  ["notifall","super shift",     [","],    ["comma"],         "Clear all notifications",   "Dismiss every notification",                       "system", 21, 0],
  ["dnd",     "super ctrl",      [","],    ["comma"],         "Do not disturb",            "Silence notifications on or off",                  "system", 14, 0],
  ["bar",     "super shift",     ["Space"],    ["space"],         "Show / hide top bar",       "More room for your windows",                       "system", 10, 0],
  ["clip",    "super ctrl",      ["V"],    ["v"],             "Clipboard history",         "Paste something you copied earlier",               "system", 72, .1],
  ["emoji",   "super ctrl",      ["E"],    ["e"],             "Emoji picker",              "Find and insert an emoji",                         "system", 36, 0],
  ["capture", "super ctrl",      ["C"],    ["c"],             "Screenshot or record",      "Capture your screen",                              "system", 43, 0],
  ["lock",    "super ctrl",      ["L"],    ["l"],             "Lock screen",               "Lock now, password to get back in",                "system", 31, .2],
  ["audio",   "super ctrl",      ["A"],    ["a"],             "Sound settings",            "Speakers, headphones and microphone",              "system", 16, 0],
  ["bt",      "super ctrl",      ["B"],    ["b"],             "Bluetooth",                 "Connect headphones and devices",                   "system", 9,  0],
  ["display", "super ctrl",      ["D"],    ["d"],             "Display settings",          "Screens, resolution and scaling",                  "system", 7,  0],
  ["scaleup", "super",           ["/"],    ["slash"],         "Make everything bigger",    "Increase screen scaling",                          "system", 5,  0],
  ["scaledn", "super alt",       ["/"],    ["slash"],         "Make everything smaller",   "Decrease screen scaling",                          "system", 4,  0],
  ["idle",    "super ctrl",      ["I"],    ["i"],             "Stay awake",                "Stop the screen from locking on its own",          "system", 5,  0],
  ["calc",    "super ctrl",      ["Q"],    ["q"],             "Calculator",                "Quick maths",                                      "system", 11, 0],
  ["night",   "super ctrl",      ["N"],    ["n"],             "Night light",               "Warmer colours, easier on the eyes",               "system", 10, 0]
]

var BINDINGS = RAW.map(function(r) {
  var mods = r[1].split(" ")
  var set = {}
  mods.forEach(function(m) { set[m] = true })
  return { id: r[0], mods: mods, modSet: set, mkey: normMods(mods), keys: r[2], match: r[3],
           label: r[4], desc: r[5], cat: r[6], seed: r[7], learn: r[8], mouse: r[3].length === 0 }
})
var BY_ID = {}
BINDINGS.forEach(function(b) { BY_ID[b.id] = b })

function normMods(list) {
  var set = {}
  list.forEach(function(m) {
    m = String(m).toLowerCase()
    if (m === "control") m = "ctrl"
    if (m === "meta" || m === "mod4" || m === "logo") m = "super"
    if (m) set[m] = true
  })
  return MOD_ORDER.filter(function(m) { return set[m] }).join(" ")
}

// Look up a binding from what the compositor reports: modifiers + xkb key name.
function findByCombo(mods, key) {
  var mk = normMods(String(mods).split(/[\s+]+/))
  var k = String(key).toLowerCase()
  var code = /^code:(\d+)$/.exec(k)            // keycodes 10–18 are the number row 1–9
  if (code && +code[1] >= 10 && +code[1] <= 18) k = String(+code[1] - 9)
  for (var i = 0; i < BINDINGS.length; i++) {
    var b = BINDINGS[i]
    if (b.mkey === mk && b.match.indexOf(k) !== -1) return b
  }
  return null
}

/* ───────────── context ───────────── */

var TERMINALS = /ghostty|alacritty|kitty|foot|wezterm|konsole|terminal/i
var BROWSERS = /zen|firefox|chrom|brave|librewolf|vivaldi|qutebrowser|epiphany/i
var EDITORS = /^code|vscod|cursor|zed|jetbrains|sublime|neovide/i
var NOTES = /obsidian|logseq|notion|typora|joplin/i

// Context key from the focused window's class and title.
function contextFor(wmclass, title) {
  var c = String(wmclass || ""), t = String(title || "")
  if (!c && !t) return "empty"
  if (TERMINALS.test(c)) {
    if (/\bn?vim\b/i.test(t)) return "term.nvim"
    if (/claude|codex|aider|[✳✻✶✢·◐◑◒◓]/i.test(t)) return "term.claude"
    return "term.shell"
  }
  if (BROWSERS.test(c)) return "browser"
  if (EDITORS.test(c)) return "editor"
  if (NOTES.test(c)) return "notes"
  return "other"
}

var CTX_LABEL = { "term.shell": "terminal", "term.nvim": "nvim", "term.claude": "agents", "browser": "browsing",
                  "editor": "coding", "notes": "writing", "other": "this app", "empty": "empty workspace" }

// Nerd Font glyphs shown as the "fits this app" reason
var CTX_ICON = {
  "term.shell": "\uf120",                     // terminal
  "term.nvim": "\ue62b",                      // vim
  "term.claude": String.fromCodePoint(0xF06A9), // robot (matches the bar's agents widget)
  "browser": String.fromCodePoint(0xF059F),     // globe
  "editor": "\uf121",                         // code
  "notes": String.fromCodePoint(0xF082E),       // notebook
  "other": "\uf2d0",                          // window
  "empty": String.fromCodePoint(0xF0415)        // plus
}

var CAT_FIT = {
  term:    { move: .75, arrange: .65, window: .5,  tabs: .3,  workspaces: .6,  apps: .45, menus: .3, system: .2 },
  browser: { move: .6,  arrange: .45, window: .6,  tabs: .35, workspaces: .6,  apps: .45, menus: .3, system: .4 },
  editor:  { move: .7,  arrange: .65, window: .5,  tabs: .3,  workspaces: .55, apps: .5,  menus: .3, system: .3 },
  notes:   { move: .5,  arrange: .45, window: .55, tabs: .3,  workspaces: .5,  apps: .45, menus: .3, system: .5 },
  other:   { move: .6,  arrange: .5,  window: .55, tabs: .3,  workspaces: .6,  apps: .5,  menus: .35, system: .35 },
  empty:   { apps: .8,  menus: .7, workspaces: .6, system: .3 }
}
var ID_FIT = {
  "term.shell":  { term: .85, tmux: .6, scratch: .5, toscr: .4, browser: .5, launch: .5 },
  "term.nvim":   { term: .9, full: .9, tfull: .5, editor: .05, clip: .4, close: .3 },
  "term.claude": { notif: .85, notifall: .5, dnd: .45, browser: .7, editor: .65, mvsil: .55, toscr: .45, clip: .55 },
  "browser":     { full: .85, pass: .9, clip: .75, capture: .7, mvws: .75, term: .7, float: .35, pop: .4 },
  "editor":      { term: .95, full: .7, browser: .6, clip: .55 },
  "notes":       { capture: .85, emoji: .7, clip: .8, browser: .6, float: .55, pop: .5 },
  "empty":       { term: 1, browser: .9, launch: .9, editor: .7, ws: .7, former: .55 }
}
// Only makes sense with another window on the workspace
var NEEDS_PEERS = { focus: 1, swap: 1, split: 1, layout: 1, resize: 1, resizeV: 1, resizeS: 1, resizeL: 1,
                    rdrag: 1, group: 1, intotab: 1, tabjump: 1, square: 1 }
var WINDOW_CATS = { move: 1, arrange: 1, window: 1, tabs: 1 }

function affinityRaw(b, ck) {
  var base = ck.indexOf("term.") === 0 ? "term" : ck
  var o = ID_FIT[ck] && ID_FIT[ck][b.id]
  if (o !== undefined) return o
  var c = CAT_FIT[base] && CAT_FIT[base][b.cat]
  return c !== undefined ? c : .15
}

function affinity(b, ck, n, wmclass, cfg) {
  if (n === 0 && (WINDOW_CATS[b.cat] || b.id === "mvws" || b.id === "mvsil" || b.id === "toscr")) return -1
  var a = affinityRaw(b, ck)
  if (n === 1 && NEEDS_PEERS[b.id]) a *= .1
  if (n >= 3 && (b.cat === "move" || b.cat === "arrange")) a = Math.min(1, a + .15)
  var nudges = cfg.apps && cfg.apps[wmclass]
  var nudge = nudges ? nudges[b.id] : undefined
  if (nudge !== undefined) {
    if (nudge <= -1) return -1
    a = Math.max(0, Math.min(1, a + nudge))
  }
  return a
}

// What tends to follow what (short-lived boost after an action)
var SEQ = {
  apps: { focus: .9, swap: .75, split: .6, mvws: .65, resize: .45, float: .3 },
  close: { focus: .7, ws: .6, term: .4 },
  ws: { term: .6, launch: .5, browser: .4 },
  mvws: { ws: .85, focus: .4 },
  full: { full: .9 },
  focus: { focus: .6, swap: .55, close: .45, full: .4, split: .35 },
  swap: { swap: .7, focus: .6, resize: .5, split: .4 },
  split: { resize: .7, swap: .6, split: .5 },
  resize: { resize: .8, resizeV: .5, swap: .3 },
  group: { tabnext: .8, intotab: .7, tabjump: .6 },
  intotab: { tabnext: .7, intotab: .6 },
  float: { pop: .5, rdrag: .5, drag: .6 }
}
var SEQ_TTL = 9000

/* ───────────── config ───────────── */

var DEFAULT_CFG = "// Super Hints  ·  ~/.config/omarchy/super-hints.jsonc\n" +
"// Changes apply as soon as you save.\n" +
"{\n" +
"  // How long to hold ❖ before hints appear (ms). Quick combos never trigger it.\n" +
"  \"delay\": 160,\n\n" +
"  // How many suggestions to show while holding ❖\n" +
"  \"rows\": 10,\n\n" +
"  // Show a short explanation under each shortcut: \"all\" | \"top\" | \"off\"\n" +
"  \"descriptions\": \"all\",\n\n" +
"  // Group suggestions under headings like Arrange, Workspaces, Apps\n" +
"  \"groupByCategory\": true,\n\n" +
"  // What decides the order (any numbers, they're balanced against each other)\n" +
"  \"weights\": {\n" +
"    \"frequency\": 0.4,   // what you use the most\n" +
"    \"context\": 0.4,     // what fits the app you're in\n" +
"    \"sequence\": 0.2     // what usually comes next\n" +
"  },\n\n" +
"  // Shortcuts you press quickly, before hints appear, count as learned\n" +
"  // and make room for ones you haven't picked up yet.\n" +
"  \"learned\": {\n" +
"    \"enabled\": true,\n" +
"    \"fastMs\": 350,      // pressed faster than this = you knew it\n" +
"    \"strength\": 0.6,    // 0 = ignore, 1 = push learned shortcuts to the bottom\n" +
"    \"hide\": false       // true = drop fully learned shortcuts entirely\n" +
"  },\n\n" +
"  // Heading order. Leave one out to hide it.\n" +
"  \"categories\": [\"move\", \"arrange\", \"window\", \"tabs\", \"workspaces\", \"apps\", \"menus\", \"system\"],\n\n" +
"  // Always show / never show (ids are listed in the pinned panel's tooltips)\n" +
"  \"pin\": [],\n" +
"  \"exclude\": [],\n\n" +
"  // Rename anything in your own words\n" +
"  \"labels\": {\n" +
"    // \"split\": { \"label\": \"Rotate split\", \"desc\": \"Side-by-side ⇄ stacked\" }\n" +
"  },\n\n" +
"  // Nudge suggestions per app (window class from hyprctl).\n" +
"  // +0.3 = more likely, -1 = never in that app\n" +
"  \"apps\": {\n" +
"    \"com.mitchellh.ghostty\": { \"split\": 0.2, \"tmux\": 0.2 },\n" +
"    \"zen\": { \"pass\": 0.2 }\n" +
"  }\n" +
"}\n"

function stripJsonc(t) {
  var o = "", i = 0, s = false
  while (i < t.length) {
    var c = t[i]
    if (s) {
      o += c
      if (c === "\\") { o += t[i + 1] || ""; i += 2; continue }
      if (c === '"') s = false
      i++; continue
    }
    if (c === '"') { s = true; o += c; i++; continue }
    if (c === "/" && t[i + 1] === "/") { while (i < t.length && t[i] !== "\n") i++; continue }
    if (c === "/" && t[i + 1] === "*") { var j = t.indexOf("*/", i + 2); i = j < 0 ? t.length : j + 2; continue }
    o += c; i++
  }
  return o.replace(/,(\s*[}\]])/g, "$1")
}

var DEFAULTS = JSON.parse(stripJsonc(DEFAULT_CFG))

function merge(d, c) {
  var out = {}, k
  for (k in d) out[k] = d[k]
  for (k in c) out[k] = c[k]
  return out
}

// Throws on invalid JSONC so callers can keep the last good config.
function parseConfig(text) {
  var c = text ? JSON.parse(stripJsonc(text)) : {}
  var cfg = merge(DEFAULTS, c)
  cfg.weights = merge(DEFAULTS.weights, c.weights || {})
  cfg.learned = merge(DEFAULTS.learned, c.learned || {})
  var w = cfg.weights
  var sum = (+w.frequency || 0) + (+w.context || 0) + (+w.sequence || 0) || 1
  cfg.W = { freq: (+w.frequency || 0) / sum, ctx: (+w.context || 0) / sum, seq: (+w.sequence || 0) / sum }
  return cfg
}

/* ───────────── stats ───────────── */

var CTXS = ["term.shell", "term.nvim", "term.claude", "browser", "editor", "notes", "other", "empty"]

function seedStats() {
  var s = { version: 1, global: {}, ctx: {}, learned: {} }
  BINDINGS.forEach(function(b) { s.global[b.id] = b.seed; s.learned[b.id] = b.learn })
  CTXS.forEach(function(c) {
    s.ctx[c] = {}
    BINDINGS.forEach(function(b) { s.ctx[c][b.id] = Math.round(b.seed * affinityRaw(b, c) * .6) })
  })
  return s
}

// Record a use. `fast` = fired before hints would have appeared.
function record(stats, id, ck, fast) {
  stats.global[id] = (stats.global[id] || 0) + 1
  if (!stats.ctx[ck]) stats.ctx[ck] = {}
  stats.ctx[ck][id] = (stats.ctx[ck][id] || 0) + 1
  stats.learned[id] = (stats.learned[id] || 0) * .8 + (fast ? .2 : 0)
}

function seqCat(b) { return b.cat === "apps" ? "apps" : b.id }

/* ───────────── ranking ───────────── */

// s = { held:[mods], ctx, n, wmclass, stats, cfg, last:{id,cat,t}|null, now, limit }
function rank(s) {
  var cfg = s.cfg, g = s.stats.global, cx = s.stats.ctx[s.ctx] || {}, L = cfg.learned
  var held = {}
  s.held.forEach(function(m) { held[m] = true })
  var heldCount = s.held.length
  var maxG = 1, maxC = 1
  BINDINGS.forEach(function(b) {
    if ((g[b.id] || 0) > maxG) maxG = g[b.id]
    if ((cx[b.id] || 0) > maxC) maxC = cx[b.id]
  })
  var lg = Math.log(1 + maxG), lc = Math.log(1 + maxC)
  var seqTbl = s.last && s.now - s.last.t < SEQ_TTL ? (SEQ[s.last.cat] || {}) : null
  var fade = seqTbl ? 1 - (s.now - s.last.t) / SEQ_TTL : 0
  var cats = {}, excl = {}, pin = {}
  cfg.categories.forEach(function(c) { cats[c] = true })
  cfg.exclude.forEach(function(id) { excl[id] = true })
  cfg.pin.forEach(function(id) { pin[id] = true })

  var out = []
  for (var i = 0; i < BINDINGS.length; i++) {
    var b = BINDINGS[i]
    if (excl[b.id] || !cats[b.cat]) continue
    var ok = true
    for (var m in held) if (!b.modSet[m]) { ok = false; break }
    if (!ok) continue
    var exact = b.mods.length === heldCount
    var a = affinity(b, s.ctx, s.n, s.wmclass, cfg)
    if (a < 0) continue
    var learned = L.enabled ? (s.stats.learned[b.id] || 0) : 0
    if (L.hide && learned > .8 && !pin[b.id]) continue
    var f = .5 * Math.log(1 + (g[b.id] || 0)) / lg + .5 * Math.log(1 + (cx[b.id] || 0)) / lc
    var sq = seqTbl ? ((seqTbl[b.id] !== undefined ? seqTbl[b.id] : 0) * fade) : 0
    var pf = cfg.W.freq * f, pc = cfg.W.ctx * a, ps = cfg.W.seq * sq
    var score = (pf + pc + ps) * (1 - L.strength * learned)
    if (!exact) score *= .5
    if (pin[b.id]) score += 10
    var why = learned > .6 ? "known" : (ps > .05 && ps >= pc * .6) ? "seq" : pc > pf ? "ctx" : "freq"
    out.push({ b: b, score: score, why: why })
  }
  out.sort(function(x, y) { return y.score - x.score })
  return s.limit ? out.slice(0, s.limit) : out
}

// Flatten ranked results into display rows: [{type:"cat",label}, {type:"row",...}]
function layout(results, s) {
  var cfg = s.cfg, rows = [], topId = results.length ? results[0].b.id : ""
  var held = {}
  s.held.forEach(function(m) { held[m] = true })
  var G = { super: "❖", shift: "⇧", ctrl: "⌃", alt: "⌥" }
  function row(r) {
    var b = r.b, lbl = cfg.labels && cfg.labels[b.id]
    var why = r.why === "known" ? "✓"
      : r.why === "seq" ? "next"
      : r.why === "ctx" ? (CTX_ICON[s.ctx] || "•")
      : (s.stats.global[b.id] || 0) + "×"
    return {
      type: "row", id: b.id, top: b.id === topId, why: r.why, whyText: why,
      label: (lbl && lbl.label) || b.label, desc: (lbl && lbl.desc) || b.desc,
      extra: b.mods.filter(function(m) { return !held[m] }).map(function(m) { return G[m] }),
      keys: b.keys, mouse: b.mouse
    }
  }
  if (cfg.groupByCategory) {
    var groups = {}, order = []
    results.forEach(function(r) {
      if (!groups[r.b.cat]) { groups[r.b.cat] = []; order.push(r.b.cat) }
      groups[r.b.cat].push(r)
    })
    if (s.pinned) order = cfg.categories.filter(function(c) { return groups[c] })
    order.forEach(function(c) {
      rows.push({ type: "cat", label: CATS[c] })
      groups[c].forEach(function(r) { rows.push(row(r)) })
    })
  } else results.forEach(function(r) { rows.push(row(r)) })
  return rows
}

// Footer hints: which extra modifier unlocks something from here.
function footer(heldList) {
  var G = { shift: "⇧", ctrl: "⌃", alt: "⌥" }
  var HINT = { shift: "apps & moving", ctrl: "settings", alt: "fine control" }
  var base = {}
  heldList.forEach(function(m) { base[m] = true })
  base.super = true
  return ["shift", "ctrl", "alt"].filter(function(m) {
    if (base[m]) return false
    var want = merge(base, {})
    want[m] = true
    var n = Object.keys(want).length
    return BINDINGS.some(function(b) {
      if (b.mods.length !== n) return false
      for (var k in want) if (!b.modSet[k]) return false
      return true
    })
  }).map(function(m) { return { glyph: G[m], hint: HINT[m] } })
}

// node test hook (ignored by QML)
if (typeof module !== "undefined") module.exports = { BINDINGS: BINDINGS, findByCombo: findByCombo, contextFor: contextFor,
  parseConfig: parseConfig, seedStats: seedStats, record: record, rank: rank, layout: layout, footer: footer,
  seqCat: seqCat, CTX_ICON: CTX_ICON, DEFAULT_CFG: DEFAULT_CFG, normMods: normMods }
