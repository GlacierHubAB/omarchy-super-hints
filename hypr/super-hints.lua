-- Super Hints compositor bridge for Omarchy (Hyprland Lua config).
--
-- Tells the Super Hints shell plugin two things:
--   1. While ❖ Super is held, which modifiers are down   → omarchy-shell super-hints mods <seq> "super shift"
--      ("" when released; resent every second as a heartbeat)
--   2. When a Super binding fires                        → omarchy-shell super-hints combo "super shift" "left"
--
-- Privacy: this never sees ordinary typing. It only wraps bindings that
-- include SUPER, and only checks modifier keys (Super/Shift/Ctrl/Alt) while
-- Super is held.
--
-- Install: require it BEFORE Omarchy's defaults in ~/.config/hypr/hyprland.lua
-- so their bindings get wrapped too:
--
--   pcall(require, "hypr.super-hints")      -- add above require("default.hypr.omarchy")

local SHELL = "omarchy-shell -q super-hints "
local POLL_MS = 40
local HEARTBEAT_TICKS = 25   -- resend state every ~1 s while Super is held

local function q(s) return "'" .. tostring(s):gsub("'", "'\\''") .. "'" end
local function ping(args) hl.exec_cmd(SHELL .. args) end

-- Each ping is its own process, so they can land out of order. Number them
-- (time-based, so a config reload never restarts below the last value) and
-- let the plugin drop anything stale.
local counter = 0
local function seq()
  counter = (counter + 1) % 1000
  return string.format("%d%03d", os.time(), counter)
end
local function send_mods(mods) ping("mods " .. seq() .. " " .. q(mods)) end

local function down(key)
  local ok, d = pcall(hl.is_key_down, key)
  return ok and d
end

local function held_mods()
  local m = { "super" }
  if down("Shift_L") or down("Shift_R") then m[#m + 1] = "shift" end
  if down("Control_L") or down("Control_R") then m[#m + 1] = "ctrl" end
  if down("Alt_L") or down("Alt_R") then m[#m + 1] = "alt" end
  return table.concat(m, " ")
end

-- 1. Super held: a short poll reports modifier changes, a heartbeat, and the release.
local watching, last, ticks = false, "", 0
local poll = hl.timer(function()
  if not watching then return end
  if not (down("Super_L") or down("Super_R")) then
    watching = false
    send_mods("")
    poll:set_enabled(false)
    return
  end
  ticks = ticks + 1
  local now = held_mods()
  if now ~= last or ticks % HEARTBEAT_TICKS == 0 then last = now; send_mods(now) end
end, { timeout = POLL_MS, type = "repeat" })
poll:set_enabled(false)

local function watch()
  if watching then return end
  watching, last, ticks = true, held_mods(), 0
  send_mods(last)
  poll:set_enabled(true)
end

-- Bound both bare and with SUPER, since Hyprland may already count Super as
-- active when its own key-down arrives. watch() ignores the duplicate.
for _, key in ipairs({ "Super_L", "Super_R", "SUPER + Super_L", "SUPER + Super_R" }) do
  hl.bind(key, watch, { ignore_mods = true, non_consuming = true, description = "Super Hints: show hints while held" })
end

-- 2. Report Super bindings as they fire, then run the original action.
local bind = hl.bind
hl.bind = function(keys, dispatcher, opts)
  if type(keys) ~= "string" or not keys:upper():find("SUPER", 1, true) or keys:lower():find("mouse", 1, true) then
    return bind(keys, dispatcher, opts)
  end
  local parts = {}
  for p in keys:gmatch("[^+%s]+") do parts[#parts + 1] = p end
  local key = table.remove(parts)
  local mods = table.concat(parts, " ")
  local action = dispatcher
  return bind(keys, function()
    ping("combo " .. q(mods) .. " " .. q(key))
    if type(action) == "function" then return action() end
    return hl.dispatch(action)
  end, opts)
end
