// Run: node test/ranker.test.js
const fs = require("fs"), path = require("path"), assert = require("assert")
const src = fs.readFileSync(path.join(__dirname, "../Ranker.js"), "utf8").replace(/^\.pragma library.*$/m, "")
const m = { exports: {} }; new Function("module", src)(m); const R = m.exports

const cfg = R.parseConfig(R.DEFAULT_CFG)
const base = { held: ["super"], ctx: "term.shell", n: 3, wmclass: "com.mitchellh.ghostty", stats: R.seedStats(), cfg, last: null, now: 1e6, limit: 10 }
let t = 0, ok = (name, fn) => { fn(); t++; console.log("✓", name) }

ok("no duplicate combos", () => {
  const seen = {}
  for (const b of R.BINDINGS) for (const k of b.match) { const key = b.mkey + "+" + k; assert(!seen[key], `dup ${key}: ${seen[key]} / ${b.id}`); seen[key] = b.id }
})
ok("findByCombo maps compositor names", () => {
  assert.equal(R.findByCombo("SUPER", "Return").id, "term")
  assert.equal(R.findByCombo("SUPER SHIFT", "left").id, "swap")
  assert.equal(R.findByCombo("super+control", "F").id, "tfull")
  assert.equal(R.findByCombo("super", "XF86Nope"), null)
  assert.equal(R.findByCombo("SUPER", "code:10").id, "ws")
  assert.equal(R.findByCombo("SUPER SHIFT", "code:18").id, "mvws")
})
ok("context from class + title", () => {
  assert.equal(R.contextFor("com.mitchellh.ghostty", "nvim globals.css"), "term.nvim")
  assert.equal(R.contextFor("com.mitchellh.ghostty", "✳ claude"), "term.claude")
  assert.equal(R.contextFor("com.mitchellh.ghostty", "zsh"), "term.shell")
  assert.equal(R.contextFor("zen", "x"), "browser")
  assert.equal(R.contextFor("", ""), "empty")
  assert.equal(R.contextFor("org.gimp.GIMP", "x"), "other")
})
ok("respects limit and only super-compatible rows", () => {
  const r = R.rank(base); assert.equal(r.length, 10); assert(r.every(x => x.b.modSet.super))
})
ok("shift narrows to shift bindings first", () => {
  const r = R.rank({ ...base, held: ["super", "shift"] }); assert(r.every(x => x.b.modSet.shift))
})
ok("empty workspace hides window ops", () => {
  const r = R.rank({ ...base, ctx: "empty", n: 0, limit: 0 }); assert(!r.some(x => ["move","arrange","window","tabs"].includes(x.b.cat)))
})
ok("single window drops tiling", () => {
  const one = R.rank({ ...base, n: 1, limit: 0 }).findIndex(x => x.b.id === "split")
  const three = R.rank({ ...base, n: 3, limit: 0 }).findIndex(x => x.b.id === "split")
  assert(one > three, `split one=${one} three=${three}`)
})
ok("learned shortcuts sink", () => {
  const s = R.seedStats(); s.learned.split = 0
  const before = R.rank({ ...base, stats: s, limit: 0 }).findIndex(x => x.b.id === "split")
  for (let i = 0; i < 10; i++) R.record(s, "split", "term.shell", true)
  const after = R.rank({ ...base, stats: s, limit: 0 }).findIndex(x => x.b.id === "split")
  assert(after > before, `before=${before} after=${after}`)
})
ok("sequence boosts what comes next", () => {
  const s = R.seedStats(), score = r => r.find(x => x.b.id === "resize").score
  const plain = score(R.rank({ ...base, stats: s, limit: 0 }))
  const seq = score(R.rank({ ...base, stats: s, limit: 0, last: { id: "split", cat: "split", t: 1e6 - 100 } }))
  assert(seq > plain, `plain=${plain} seq=${seq}`)
})
ok("config: exclude, pin, app nudge -1", () => {
  const c = R.parseConfig('{ "exclude": ["focus"], "pin": ["night"], "apps": { "zen": { "pass": -1 } } }')
  const r = R.rank({ ...base, cfg: c, ctx: "browser", wmclass: "zen", held: ["super"], limit: 0 })
  assert(!r.some(x => x.b.id === "focus")); assert.equal(r[0].b.id, "night"); assert(!r.some(x => x.b.id === "pass"))
})
ok("config: bad JSON throws, partial merges", () => {
  assert.throws(() => R.parseConfig("{ nope"))
  const c = R.parseConfig('{ "learned": { "strength": 1 } }'); assert.equal(c.learned.fastMs, 350); assert.equal(c.learned.strength, 1)
})
ok("layout groups rows under headings", () => {
  const rows = R.layout(R.rank(base), base)
  assert.equal(rows[0].type, "cat"); assert(rows.some(r => r.type === "row" && r.top))
})
ok("rank+layout is fast", () => {
  const t0 = process.hrtime.bigint(); for (let i = 0; i < 1000; i++) R.layout(R.rank(base), base)
  const us = Number(process.hrtime.bigint() - t0) / 1000 / 1000; console.log(`   ${us.toFixed(1)} µs per rank+layout`); assert(us < 1000)
})
console.log(`\n${t} passed`)
