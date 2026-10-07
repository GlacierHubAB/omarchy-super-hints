import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import Quickshell.Hyprland
import qs.Commons
import qs.Ui
import "Ranker.js" as R

// Super Hints: a ❖ bar button plus a hint panel. The panel goes live while Super
// is held (driven over IPC by the compositor) and can be pinned open by click.
//
//   omarchy-shell super-hints mods <seq> "super shift"   held modifiers ("" = released), from the bridge
//   omarchy-shell super-hints hold "super shift"   modifiers currently held (manual testing)
//   omarchy-shell super-hints release              all modifiers released
//   omarchy-shell super-hints combo super return   a binding fired (mods + xkb key)
//   omarchy-shell super-hints used split           a binding fired (by id)
//   omarchy-shell super-hints state                JSON snapshot for debugging
Panel {
  id: root
  moduleName: "io.github.glacierhubab.super-hints"
  ipcTarget: "super-hints"
  manageIpc: false

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  readonly property string home: Quickshell.env("HOME")
  readonly property string configPath: home + "/.config/omarchy/super-hints.jsonc"
  readonly property string stateDir: home + "/.local/state/omarchy/super-hints"
  readonly property string statsPath: stateDir + "/stats.json"

  property var cfg: R.parseConfig("")
  property string cfgError: ""
  property var stats: R.seedStats()
  property var held: []
  property bool live: false
  property real inputAt: 0
  property var last: null
  property var rows: []
  property var foot: []
  property string fireId: ""
  property real lastSeq: 0

  readonly property bool showing: live || opened
  readonly property var toplevel: ToplevelManager.activeToplevel
  readonly property string wmclass: toplevel ? (toplevel.appId || "") : ""
  readonly property string winTitle: toplevel ? (toplevel.title || "") : ""
  readonly property var workspace: Hyprland.focusedWorkspace
  readonly property int nWindows: workspace ? workspace.toplevels.values.length : 0
  readonly property string ctx: nWindows === 0 ? "empty" : R.contextFor(wmclass, winTitle)

  readonly property color fg: Color.popups.text
  function fa(a) { return Qt.rgba(fg.r, fg.g, fg.b, a) }
  readonly property var glyphs: ({ super: "❖", shift: "⇧", ctrl: "⌃", alt: "⌥" })

  /* ───────── state changes ───────── */

  // Bridge events carry a sequence number: drop anything older than what we've
  // seen (pings are separate processes and can arrive out of order), and treat
  // a missing heartbeat as a release.
  function modsEvent(seq, mods) {
    var n = Number(seq)
    if (!(n > lastSeq)) return
    lastSeq = n
    if (String(mods || "") === "") { release(); return }
    watchdog.restart()
    hold(mods)
  }

  function hold(mods) {
    var list = R.normMods(String(mods || "").split(/[\s+,]+/)).split(" ").filter(function(m) { return m !== "" })
    if (list.join(" ") !== held.join(" ")) inputAt = Date.now()   // heartbeats don't reset press timing
    held = list
    if (list.indexOf("super") === -1) { release(); return }
    if (showing) refresh()
    else if (!showTimer.running) showTimer.start()
  }

  function release() {
    held = []
    showTimer.stop()
    watchdog.stop()
    live = false
    if (opened) refresh()
  }

  function used(id) {
    var b = R.BY_ID[id]
    if (!b) return "unknown"
    var now = Date.now()
    var fast = !showing && (now - inputAt) < Math.max(cfg.learned.fastMs, cfg.delay)
    R.record(stats, id, ctx, fast)
    last = { id: id, cat: R.seqCat(b), t: now }
    inputAt = now
    saveTimer.restart()
    if (showing) { fireId = id; refresh() }
    else showTimer.stop()
    return fast ? "fast" : "slow"
  }

  function combo(mods, key) {
    var b = R.findByCombo(mods, key)
    return b ? used(b.id) : "unmatched"
  }

  function refresh() {
    var heldNow = held.length ? held : (opened ? [] : ["super"])
    var s = { held: heldNow, ctx: ctx, n: nWindows, wmclass: wmclass, stats: stats, cfg: cfg, last: last,
              now: Date.now(), pinned: opened && held.length <= 1, limit: (opened && held.length <= 1) ? 0 : cfg.rows }
    rows = R.layout(R.rank(s), s)
    foot = R.footer(heldNow)
    Qt.callLater(function() { root.fireId = "" })
  }

  function openSettings() {
    // Seed the file with commented defaults the first time, then open the user's editor.
    Quickshell.execDetached(["sh", "-c",
      'test -f "$1" || { mkdir -p "$(dirname "$1")" && printf "%s" "$2" > "$1"; }; exec omarchy-launch-editor "$1"',
      "sh", configPath, R.DEFAULT_CFG])
    close()
  }

  onCtxChanged: if (showing) refresh()
  onNWindowsChanged: if (showing) refresh()
  onOpenedChanged: if (opened) refresh()

  Timer {
    id: showTimer
    interval: Math.max(0, root.cfg.delay)
    onTriggered: if (root.held.indexOf("super") !== -1) { root.live = true; root.refresh() }
  }

  Timer {
    id: watchdog
    interval: 2500
    onTriggered: root.release()
  }

  /* ───────── persistence ───────── */

  function loadConfig(text) {
    try { cfg = R.parseConfig(text); cfgError = "" }
    catch (e) { cfgError = String(e.message || e) }   // keep the last good config
    if (showing) refresh()
  }

  function loadStats(text) {
    try {
      var s = JSON.parse(text)
      var seed = R.seedStats()
      ;["global", "learned"].forEach(function(k) { s[k] = Object.assign({}, seed[k], s[k] || {}) })
      s.ctx = Object.assign({}, seed.ctx, s.ctx || {})
      stats = s
    } catch (e) { /* first run or unreadable: keep seeded stats */ }
  }

  FileView {
    id: configFile
    path: root.configPath
    watchChanges: true
    printErrors: false
    onLoaded: root.loadConfig(text())
    onLoadFailed: root.loadConfig("")
    onFileChanged: reload()
  }

  FileView {
    id: statsFile
    path: root.statsPath
    atomicWrites: true
    printErrors: false
    onLoaded: root.loadStats(text())
  }

  Process {
    id: mkStateDir
    command: ["mkdir", "-p", root.stateDir]
  }
  Component.onCompleted: mkStateDir.running = true

  Timer {
    id: saveTimer
    interval: 2000
    onTriggered: statsFile.setText(JSON.stringify(root.stats) + "\n")
  }

  IpcHandler {
    target: root.ipcTarget
    function mods(seq: string, mods: string): void { root.modsEvent(seq, mods) }
    function hold(mods: string): void { root.hold(mods) }
    function release(): void { root.release() }
    function used(id: string): string { return root.used(id) }
    function combo(mods: string, key: string): string { return root.combo(mods, key) }
    function open(): void { root.open() }
    function close(): void { root.close() }
    function toggle(): void { root.toggle() }
    function settings(): void { root.openSettings() }
    function ping(): string { return "ok" }
    function state(): string {
      return JSON.stringify({ ctx: root.ctx, wmclass: root.wmclass, title: root.winTitle, windows: root.nWindows,
        held: root.held, live: root.live, pinned: root.opened, configError: root.cfgError,
        top: root.rows.filter(function(r) { return r.type === "row" }).slice(0, 5).map(function(r) { return r.id }) })
    }
  }

  /* ───────── bar button ───────── */

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "❖" + (root.live ? root.held.filter(function(m) { return m !== "super" }).map(function(m) { return root.glyphs[m] }).join("") : "")
    active: root.showing
    activeColor: Color.accent
    horizontalMargin: 7
    tooltipText: root.showing ? "" : "Shortcut hints · hold ❖ or click"
    onPressed: function(b) {
      if (b === Qt.RightButton) root.openSettings()
      else root.toggle()
    }
  }

  /* ───────── panel ───────── */

  PopupCard {
    id: popup
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.showing
    triggerMode: root.opened ? "click" : "hover"
    padding: 0
    contentWidth: popup.fittedContentWidth(Style.space(380))
    contentHeight: popup.fittedContentHeight(content.implicitHeight + Style.space(14))

    Flickable {
      anchors.fill: parent
      anchors.topMargin: Style.space(8)
      anchors.bottomMargin: Style.space(6)
      contentHeight: content.implicitHeight
      interactive: root.opened && contentHeight > height
      boundsBehavior: Flickable.StopAtBounds
      clip: true

      Column {
        id: content
        width: parent.width

        // header: app · context, workspace info, settings cog (pinned only)
        Item {
          width: parent.width
          height: Style.space(26)
          Text {
            id: appText
            anchors.left: parent.left; anchors.leftMargin: Style.space(12)
            anchors.right: wsText.left; anchors.rightMargin: Style.space(8)
            anchors.verticalCenter: parent.verticalCenter
            text: root.nWindows === 0 ? "empty workspace"
              : (root.wmclass.split(".").pop().toLowerCase() || "window") + " · " + (R.CTX_LABEL[root.ctx] || "")
            color: root.fa(0.72); font.family: Style.font.family; font.pixelSize: Style.font.bodySmall
            elide: Text.ElideRight
          }
          Text {
            id: wsText
            anchors.right: cog.visible ? cog.left : parent.right
            anchors.rightMargin: cog.visible ? Style.space(4) : Style.space(12)
            anchors.verticalCenter: parent.verticalCenter
            text: "ws " + (root.workspace ? root.workspace.name : "?") + " · " + root.nWindows + (root.nWindows === 1 ? " window" : " windows")
            color: root.fa(0.38); font.family: Style.font.family; font.pixelSize: Style.font.bodySmall
          }
          Rectangle {
            id: cog
            visible: root.opened
            width: Style.space(22); height: width; radius: Style.space(4)
            anchors.right: parent.right; anchors.rightMargin: Style.space(6)
            anchors.verticalCenter: parent.verticalCenter
            color: cogArea.containsMouse ? root.fa(0.08) : "transparent"
            Text {
              anchors.centerIn: parent
              text: ""
              color: cogArea.containsMouse ? root.fa(0.92) : root.fa(0.38)
              font.family: Style.font.family; font.pixelSize: Style.font.body
            }
            MouseArea { id: cogArea; anchors.fill: parent; hoverEnabled: true; onClicked: root.openSettings() }
          }
        }
        Rectangle { width: parent.width; height: 1; color: root.fa(0.06) }

        Text {
          visible: root.cfgError !== ""
          width: parent.width; leftPadding: Style.space(12); rightPadding: Style.space(12); topPadding: Style.space(6)
          text: "super-hints.jsonc: " + root.cfgError
          color: Color.urgent; font.family: Style.font.family; font.pixelSize: Style.font.caption
          wrapMode: Text.Wrap
        }

        Text {
          visible: root.rows.length === 0
          leftPadding: Style.space(12); topPadding: Style.space(8); bottomPadding: Style.space(4)
          text: "No shortcuts use " + root.held.map(function(m) { return root.glyphs[m] }).join(" ")
          color: root.fa(0.38); font.family: Style.font.family; font.pixelSize: Style.font.body
        }

        Repeater {
          model: root.rows
          delegate: Item {
            id: entry
            required property var modelData
            readonly property bool isCat: modelData.type === "cat"
            readonly property bool showDesc: !isCat && (root.cfg.descriptions === "all" || (root.cfg.descriptions === "top" && modelData.top))
            width: content.width
            height: isCat ? Style.space(24) : Math.max(Style.space(26), textCol.implicitHeight + Style.space(8))

            Text {
              visible: entry.isCat
              anchors.left: parent.left; anchors.leftMargin: Style.space(12)
              anchors.bottom: parent.bottom; anchors.bottomMargin: Style.space(2)
              text: entry.isCat ? entry.modelData.label.toUpperCase() : ""
              color: root.fa(0.38); font.family: Style.font.family; font.pixelSize: Style.font.caption
              font.letterSpacing: 0.6
            }

            // top-row highlight + accent bar
            Rectangle {
              anchors.fill: parent
              visible: !entry.isCat && entry.modelData.top
              gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0; color: root.fa(0.08) }
                GradientStop { position: 1; color: "transparent" }
              }
            }
            Rectangle {
              visible: !entry.isCat && entry.modelData.top
              x: 0; y: Style.space(6); width: 2; height: parent.height - Style.space(12); radius: 1
              color: Color.accent
            }
            Rectangle {
              id: flash
              anchors.fill: parent
              color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.22)
              opacity: 0
              NumberAnimation on opacity { id: flashAnim; running: false; from: 1; to: 0; duration: 320; easing.type: Easing.OutCubic }
            }
            Component.onCompleted: if (!isCat && modelData.id === root.fireId) flashAnim.start()

            Row {
              id: keyRow
              visible: !entry.isCat
              x: Style.space(12)
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(3)
              Repeater {
                model: entry.isCat ? [] : entry.modelData.extra.map(function(k) { return { k: k, extra: true } })
                  .concat(entry.modelData.keys.map(function(k) { return { k: k, extra: false } }))
                delegate: Rectangle {
                  required property var modelData
                  height: Style.space(18)
                  width: Math.max(height, cap.implicitWidth + Style.space(10))
                  radius: Style.space(4)
                  color: "transparent"
                  border.width: 1
                  border.color: modelData.extra ? root.fa(0.08)
                    : (entry.modelData.top ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.45) : root.fa(0.12))
                  Text {
                    id: cap
                    anchors.centerIn: parent
                    text: parent.modelData.k
                    color: parent.modelData.extra ? root.fa(0.38) : root.fa(entry.modelData.mouse ? 0.72 : 0.92)
                    font.family: Style.font.family
                    font.pixelSize: entry.modelData.mouse ? Style.font.caption : Style.font.bodySmall
                  }
                }
              }
            }

            Column {
              id: textCol
              visible: !entry.isCat
              x: Style.space(110)
              width: parent.width - x - whyText.implicitWidth - Style.space(22)
              anchors.verticalCenter: parent.verticalCenter
              Text {
                width: parent.width
                text: entry.isCat ? "" : entry.modelData.label
                color: entry.isCat ? "transparent" : root.fa(entry.modelData.top ? 0.92 : (entry.modelData.why === "known" ? 0.52 : 0.72))
                font.family: Style.font.family; font.pixelSize: Style.font.body
                elide: Text.ElideRight
              }
              Text {
                visible: entry.showDesc
                width: parent.width
                text: entry.isCat ? "" : entry.modelData.desc
                color: root.fa(0.38)
                font.family: Style.font.family; font.pixelSize: Style.font.bodySmall - 1
                elide: Text.ElideRight
              }
            }

            Text {
              id: whyText
              visible: !entry.isCat
              anchors.right: parent.right; anchors.rightMargin: Style.space(12)
              anchors.verticalCenter: parent.verticalCenter
              text: entry.isCat ? "" : entry.modelData.whyText
              color: entry.isCat ? "transparent"
                : entry.modelData.why === "seq" ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.8)
                : entry.modelData.why === "ctx" ? root.fa(0.38) : root.fa(0.24)
              font.family: Style.font.family
              font.pixelSize: !entry.isCat && entry.modelData.why === "ctx" ? Style.font.body : Style.font.caption
            }

          }
        }

        // footer: what each extra modifier unlocks
        Rectangle { visible: root.foot.length > 0; width: parent.width; height: 1; color: root.fa(0.06) }
        Row {
          visible: root.foot.length > 0
          leftPadding: Style.space(12); topPadding: Style.space(6)
          spacing: Style.space(12)
          Repeater {
            model: root.foot
            delegate: Text {
              required property var modelData
              text: "+" + modelData.glyph + " " + modelData.hint
              color: root.fa(0.24); font.family: Style.font.family; font.pixelSize: Style.font.caption
            }
          }
        }
      }
    }
  }
}
