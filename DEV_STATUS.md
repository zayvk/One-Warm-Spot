# One Warm Spot — Development Status & Architecture

> Technical reference for contributors and AI copilots.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript (strict mode) | ~7.0 |
| Bundler | Vite | 8.3.x |
| UI Framework | React | 19.x |
| 2D Renderer | PixiJS (`pixi.js`) | 8.x |
| State Management | Zustand | 5.x |
| Audio | Web Audio API (zero deps) | Built-in |
| Testing | Vitest (unit) · Playwright (E2E, system Chrome) | 5.1.x in `package.json` / lockfile (an older local `node_modules` may still hold 3.x — `npm ci` syncs it) · 1.65.x |
| Hosting | GitHub Pages (temporary test host, auto-deployed by GitHub Actions) | https://zayvk.github.io/One-Warm-Spot/ |
| Runtime | Node.js | v24.14.1 (verified with `node -v`) |
| Package Manager | npm | 11.11.0 |

---

## Repository Structure

```
One-Warm-Spot/
├── GAME_CONTEXT.md              # Creative & design bible
├── DEV_STATUS.md                # This file — architecture & tracker
├── index.html                   # Entry HTML (Google Fonts, ./favicon.png + ./apple-touch-icon.png — relative, sub-path safe)
├── package.json
├── tsconfig.json / .app / .node / .e2e # TypeScript project references, strict: true (.e2e type-checks e2e/ + playwright.config.ts)
├── vite.config.ts               # base: './' (relative build: works at a root domain and under /One-Warm-Spot/)
├── .github/workflows/deploy-pages.yml # Push to main / manual run → npm ci + npm run build → GitHub Pages
├── playwright.config.ts         # E2E: system Chrome (channel 'chrome'), 1376×768, 1 worker, starts `vite --port 5180`
├── e2e/                         # Playwright specs (*.e2e.ts) + helpers.ts (stage→screen mapping via fitStage, localStorage readers, fresh-run flow)
├── public/
│   ├── favicon.png / apple-touch-icon.png  # Browser tab & home-screen icons (favicon.svg is no longer linked)
│   └── source/                  # All active art & audio assets live here
│       ├── ui/                  # Brand art: logo-title.webp (Title wordmark), logo-emblem.webp (lantern crest)
│       ├── backgrounds/         # Background images (bg-title, bg-valley, bg-terrace...bg-island.webp)
│       ├── sprites/             # Traveler sprites: {female,male}-{idle,walk,search,sit,sleep,reach,peek,fix}.webp + 4-frame walk cycle {female,male}-walk-{1..4}.webp
│       ├── scenes/              # Interactive stage backdrops (terrace-stage.webp — v2 with stairwell/lift bulkhead)
│       ├── cutscenes/           # Terrace lift & building plates (terrace-lobby = Floor 1, terrace-floor-2/3/4, terrace-lift-frame w/ transparent doorway, terrace-lift-door)
│       ├── props/               # Interactive prop sprites: wooden crates (boxes-intact/cleared, box-double), cardboard-1/2/3 cartons (+ legacy box-single parcel), weeds-1/2/3, and every station tier —
│       │                        #   shelter (cloth-shed, shed-upgraded, shelter-t3), fire pit (firepit-t1, firepit-t2, firepit), farm (planter-t1, planter, planter-t3),
│       │                        #   barrel (barrel-t1, rain-barrel, barrel-t3), grill (grill-rack, grill-t1..t3), sewing (sew-needle, sew-scraps, knit-t1..t3)
│       └── audio/               # Optional music-menu.mp3 (not shipped — procedural warm-pad loop plays instead)
└── src/
    ├── main.tsx                 # React root mount
    ├── App.tsx                  # Screen router: title → site-select → arrival → shelter (R) ⇄ ride ⇄ floor (1–4) (+ global toasts)
    ├── styles/
    │   └── theme.css            # CSS custom properties, cozy palette, frosted-card util, pouch pulse/tooltips, prop menu, shared lift-cutscene keyframes, floor hotspot glow, brass elevator panel, fuse-box sparks
    ├── game/                    # ── Pure game logic (no React imports) ──
    │   ├── types/game.ts        # SiteId, TimeOfDay, Weather, PlayerStats, Upgrade, ScavengeZone, Relic, SaveState…
    │   ├── data/
    │   │   ├── sites.ts         # 9 shelter sites (5 cozy + 4 challenge) + milestone unlock requirements
    │   │   ├── resources.ts     # 7 core materials incl. 🍅 food (+ storage caps)
    │   │   ├── modes.ts         # Cozy vs. Challenge rules, starting materials, ⚠️ TEST_MODE_GENEROUS_START pool, weather odds & WEATHER_INFO (label, emoji, rooftop effect, morning line)
    │   │   ├── scavengeZones.ts # 4 nearby valley scavenging spots (yields + discovery lines)
    │   │   ├── relics.ts        # 8 Valley Relics (Field Journal keepsakes)
    │   │   ├── survivalKit.ts   # 5-item Day 1 kit (with "how it helps" copy)
    │   │   ├── upgrades.ts      # The 10 macro upgrades (cost, energy, cozy, tier prerequisite) + categories
    │   │   ├── recipes.ts       # 5 grill RECIPES (tier, ingredients, ⚡/❤️, needsFire) + 3 MENDING_PERKS
    │   │   ├── floors.ts        # Old apartment building: BuildingFloorId (1–4 | 'R'), BUILDING_FLOORS (painting + % hotspots, optional live `puzzle` with reward / repaired label & toasts, `enterable` room doors), ELEVATOR_STOPS, liftTickSequence, liftRideTimeline
    │   │   ├── rooms.ts         # Apartment room interiors: 4 RoomTypes (shell + 5 props each), curated anchor zones, generateRoomLayout(doorId, rng?), parseRoomLayout, roomSafeArea
    │   │   ├── media.ts         # Background, sprite, stage, prop (all station tier sprites), cutscene & Jigsaw painting (JIGSAW_IMAGES, not preloaded) paths + fallback gradients
    │   │   └── scenes/
    │   │       ├── types.ts     # ShelterSceneConfig, HotspotConfig, SceneObstacle, StationConfig / StationTierConfig, BuildSlotConfig, AssignableStationId schema (normalized 0–1 coords)
    │   │       ├── terrace.ts   # Old Apartment Terrace config (hotspots, TERRACE_STATIONS — 6 multi-tier stations, TERRACE_BUILD_SLOTS — 4 flexible slots, box/weed variant tables, default + spawn rules)
    │   │       └── index.ts     # getSceneConfig() registry (terrace only for now)
    │   ├── engine/
    │   │   ├── dayCycle.ts    # Pure 3-phase 12-min day clock (240s/phase), Stamina/Strength rest & sleep math (SleepComfort, decay params)
    │   │   ├── stations.ts      # Pure station rules: next tier, harvest/collect yields, sleep comfort, gloves/cloak perks, recipeBlocker/applyRecipe, perkBlocker, stationRequirementHint (natural tier names)
    │   │   ├── progression.ts   # Pure rules: time-of-day, Cozy Index, upgrade status/build, canAfford/spendResources, site unlocks
    │   │   ├── scavenge.ts      # Pure runScavenge(), trip availability, capped resource adds
    │   │   ├── weather.ts       # Daily weather roll (clear / rain / wind), legacy 'breezy'/'storm' → wind (normalizeWeather), soft-rain water bonus, windy box bonus (windBoxBonus)
    │   │   ├── saveSystem.ts    # v4 save: strict validation, migration, persistent progress
    │   │   ├── backup.ts        # .json backups: SaveState (+ stats) + Terrace `terraceState` (incl. repairedSpots); strict validate, export/import
    │   │   ├── terraceState.ts  # `ows_terrace_state` parse/validate/load/save/clear (fire, boxes, weeds, 6 station tiers, ready flags, perks, spawns, repairedSpots, failedTodaySpots, roomLayouts; legacy builtProps migration) + withSpotRepaired / markStoredSpotRepaired / applyFloorNightReset / storeRoomLayout
    │   │   ├── terraceSpawns.ts # Pure seeded crate / carton / weed placement: generateTerraceSpawns, regrowTerraceSpawns (weather-driven overnight), repairTerraceSpawns, perimeterDistance, findSpawnProblems
    │   │   ├── buildSlots.ts    # Pure flexible build-slot rules: placeStationInSlot, unplacedStations, reconcileSlotAssignments (legacy migration), parseSlotAssignments (strict/lenient)
    │   │   ├── stageFit.ts      # Pure stage & UI-scale maths: fitStage() (cover-fit, never crops the safe area), stageLeavesGaps, stagePointToPx / pxToStagePoint, uiScaleFor / uiTextScaleFor (--ui-scale), hudFrameInsets (ultrawide HUD frame), rendererResolution (DPR ≤ 2)
    │   │   ├── assetUrl.ts      # assetUrl(path, base = import.meta.env.BASE_URL): every public/ file URL, deploy-location safe ('/', './', '/One-Warm-Spot/')
    │   │   ├── resumeLocation.ts # Refresh-resume: per-tab sessionStorage location (title / site-select / rooftop / floor N / room behind an open door), validated against the run
    │   │   └── __tests__/       # Vitest suites (save, scavenging & modes, progression & unlocks, day cycle, Terrace state/spawns, stations & cooking, backups, floors, stage fit, refresh-resume)
    │   ├── minigames/
    │   │   ├── types.ts         # Shared mini-game contract: MiniGameOutcome ('win'|'draw'|'loss'|'cancelled'), MiniGameResult, MiniGameProps
    │   │   ├── ticTacToe.ts     # Pure Tic-Tac-Toe rules (applyMove, evaluateBoard, findWinningMove) + chooseCpuMove(board, mode, rng?) Cozy / Challenge AI (memoized minimax)
    │   │   ├── jigsaw.ts        # Pure Jigsaw engine: interlocking edges, buildPiecePath SVG cutter, pickJigsawImage, createJigsawState / placePiece / isSolved (seedable)
    │   │   ├── dotsAndBoxes.ts  # Pure Dots & Lines (Dots and Boxes) engine: applyEdgeMove (extra turn on a closed box), dotsStatus, chooseDotsCpuMove(state, mode, rng?) Cozy / Challenge AI
    │   │   ├── findTheObject.ts # Pure Find the Object "Rummage Pile" engine: 18-item RUMMAGE_ITEMS catalog, createRummageState, movePileItem / nudgeClutterItem / collectTargetItem, getNextHintTargetId (seedable)
    │   │   ├── connectWires.ts  # Pure Connect the Wires engine: WIRE_SPECS (colour + symbol), createWireState (deranged terminals), tryConnectWire, isWireBoxFixed (seedable)
    │   │   ├── safeDial.ts      # Pure Safe Dial engine: 40-notch dial, 3 spaced targets with alternating directions, rotateDial (tick / near / catch), lockTumbler, Cozy ±2 vs Challenge ±1 + 3 tries (seedable)
    │   │   ├── hitTheNail.ts    # Pure Hit the Nail engine: green zones per mode, markerAt triangle sweep, sweepMs, strikeNail (hit / early / late), Challenge 3-miss limit (seedable)
    │   │   └── __tests__/       # ticTacToe, jigsaw, dotsAndBoxes, findTheObject, connectWires, safeDial, hitTheNail, miniGameClose (.test.ts)
    │   ├── audio/
    │   │   └── soundEngine.ts   # Web Audio singleton: Music & SFX/Ambience channels, 9 site soundscapes, rooftop weather layer (setWeatherAmbience), shelter + lift foley (incl. playHarvest / playCook / playSew), mini-game playBoxChime, room interiors (setRoomTone, playDoorCreak), Safe Dial ticks / latch (playDialTick, playSafeOpen), Hit the Nail (playNailClang / Tink / Finish)
    │   ├── store/
    │   │   └── useGameStore.ts  # Zustand store (day/vitality, resources, cookRecipe, strengthDriftFactor, upgrades, scavenging, relics, stats, notices)
    │   └── renderer/
    │       ├── ShelterCanvas.tsx # React bridge: Pixi Application + ResizeObserver + reward/build/spend/cook/sleep/notice/door bridges + { requestBuild, performStationAction, cook, craftPerk } handle
    │       ├── preloadScene.ts   # preloadShelterScene(siteId): dynamic-imports the Pixi scene chunk and warms the backdrop (used by the arrival / lift cutscenes) — PixiJS stays out of the main bundle
    │       ├── shelterScene.ts   # Data-driven point-and-click Pixi scene: stage-space (safe-area cover rect) mapping, backdrop (+ blurred fill), pose crossfades, hotspots & hover feedback, obstacles, multi-tier stations, overnight regrowth, particles, rain overcast lighting & weed sway
    │       └── weatherLayer.ts   # Pooled live weather: rain streaks + floor ripples + misty wash, wind dust motes + tumbling leaves + gust strength
    └── ui/
        ├── TitleScreen.tsx           # Painted logo-title wordmark floating cleanly without backdrop halo (+ sr-only h1) + Continue/New Game + About / Load Backup
        ├── backupImport.ts           # Shared `restoreBackupFile()` used by Title Load Backup & Settings import
        ├── SiteSelector.tsx          # Uniform 38px header toggles, traveler sprite portraits, centered flex-wrap shelter cards
        ├── ArrivalCutscene.tsx       # Cutscene shell (fade-out, Skip button, Space/Enter/Escape); Ken Burns fade for most shelters
        ├── cutsceneKeys.ts           # isCutsceneSkipKey(): Space/Enter/Escape skip only when no control is focused and no dialog (e.g. Settings) is open
        ├── keepInView.ts             # Pure menuMaxHeight / menuShift + useKeepInView(): floating menus stay below the measured top HUD ([data-hud-top]) and above the bottom edge (scroll if taller); anchoredMenuStyle() pins a menu to its in-world anchor, scaled by --ui-text-scale
        ├── __tests__/keepInView.test.ts # Floating-menu placement across the 7 target landscape windows
        ├── minigames/TicTacToeGame.tsx # Parchment Tic-Tac-Toe card implementing MiniGameProps — LIVE on Floors 1 & 3 (+ axe-gated doors)
        ├── minigames/JigsawGame.tsx # Interlocking-piece Jigsaw card implementing MiniGameProps (not mounted yet — ready for a floor/apartment hotspot)
        ├── minigames/DotsAndBoxesGame.tsx # Hand-inked Dots & Lines card implementing MiniGameProps — LIVE on Floors 1–4
        ├── minigames/FindTheObjectGame.tsx # Wooden rummage-drawer card implementing MiniGameProps (not mounted yet — ready for a floor/apartment hotspot)
        ├── minigames/rummageIcons.tsx # Hand-inked SVG art for the 18 rummage items (RummageArt in the pile, RummageIcon for the checklist) — 0 image files
        ├── minigames/ConnectWiresGame.tsx # Steel junction-box wiring card implementing MiniGameProps — LIVE on Floor 3's fuse box
        ├── minigames/SafeDialGame.tsx # Antique-brass combination dial on slate steel implementing MiniGameProps (not mounted yet — ready for a room safe)
        ├── minigames/HitTheNailGame.tsx # Plank, 3 rusty nails, hammer + timing bar implementing MiniGameProps (not mounted yet)
        ├── minigames/miniGameClose.ts # Shared × / Escape behaviour: cancel while playing, report the result once finished (miniGameClose + useMiniGameEscape)
        ├── TerraceLiftCutscene.tsx   # Lift ride between any two stops (fromFloor → toFloor): push-in / step-in, ticking indicator, destination painting + caption; the arrival is the 1 → R ride
        ├── LiftRideScreen.tsx        # Full-screen shell for in-building rides (fade-out, Skip button / click / Space-Enter-Escape)
        ├── ElevatorPanelModal.tsx    # Antique brass floor picker (R, 4, 3, 2, 1; current floor lit & disabled; Cancel / outside click / Escape)
        ├── BuildingFloorScreen.tsx   # One explorable apartment floor (1–4) from floors.ts on a safe-area stage (fitStage + floorSafeArea, blurred fill on extreme shapes): % hotspots with glow + "puzzle coming soon" toast (or a live puzzle: Floor 3's fuse box → ConnectWiresGame, repaired once per run), fuse-box electric arcs until repaired, the lift (opens the floor panel), floor title; opened room doors read "Enter · …" and lead into ApartmentRoomScreen
        ├── ApartmentRoomScreen.tsx   # Inside an opened door: generated room on a safe-area stage — grounded props with contact shadows, pointer parallax, window dust, time-of-day/weather light, inspect toasts, ← Back / Escape, room tone
        ├── useViewport.ts            # The one visible-viewport source (visualViewport + resize / orientation): useViewport(), installViewportVars() (--app-w / --app-h / --ui-scale / --hud-frame-*), useHudStageFrame(stage)
        ├── buildingStage.ts          # useBuildingStage(safe) + stageBox(): 1376×768 building stages (lift, push-in) fitted with fitStage
        ├── liftStage.tsx             # Shared lift pieces: StageFill (soft blurred band fill), sliding doors, frame, amber floor readout (sized to the fitted stage), caption
        ├── ShelterScreen.tsx         # Playable shelter view: full-viewport canvas (lazy-loaded `ShelterCanvas` chunk behind a `.ows-scene-loader` emblem) + ← Title + emblem badge + weather chip (☀️ Clear / 🌧️ Rain / 🍃 Wind, effect tooltip) + 7-item Pouch HUD (hover/focus tooltips) + VitalityDialHud; drives setWeatherAmbience + PropActionMenu + StationPopover; the stairwell door opens ElevatorPanelModal (`onRide`)
        ├── VitalityDialHud.tsx       # Bottom-left bronze Vitality Medallion (80px; phase sky window + progress ring + centred Day plaque) + slim smoked-glass Stamina/Strength capsule tucked behind it
        ├── PropActionMenu.tsx        # Contextual floating pill above clicked stations: Primary Action (Rest/Sleep/Light/Sit/Extinguish/Harvest/Collect/Cook/Mend) + Upgrade tier action; `SlotBuildMenu` for empty "Build here" slots
        ├── StationPopover.tsx        # Frosted Cooking (grill recipes) / Mending (sewing perks) popover anchored above the station
        ├── TopBar.tsx                # 💤 Dormant M1 HUD bar (unmounted — see "Archived / Unmounted M1 Files")
        ├── UpgradePanel.tsx          # 💤 Dormant M1 Upgrade drawer (unmounted)
        ├── ScavengePanel.tsx         # 💤 Dormant M1 Valley Scavenge drawer (unmounted)
        ├── SurvivalKitPanel.tsx      # 💤 Dormant M1 Survival Kit / Field Journal drawer (unmounted)
        ├── ConfirmResetModal.tsx     # 💤 Dormant in-shelter Reset Save confirmation (unmounted)
        ├── NoticeToasts.tsx          # Gentle toasts (Day N · Morning + regrowth/weather, new shelter unlocked, firewood hint, "scavenging puzzle coming soon", backups)
        ├── SettingsPopover.tsx       # Top-right popover: Music/SFX sliders, Reduce Motion (+ helper line), Export / Load Backup; its Escape (capture phase) closes only the popover
        ├── ConfirmOverwriteModal.tsx # Safety modal before overwriting an existing saved shelter
        ├── AboutModal.tsx            # Player-facing About: emblem crest, 2-paragraph story, 3 How-to-play tips, v0.1 footer
        ├── BackgroundStage.tsx       # Full-viewport crossfade background (image/video/gradient)
        └── AudioToggle.tsx           # Floating Settings gear + Mute/Unmute cluster (z-index 75: stays reachable above mini-game cards and the lift panel)
```

---

## Responsive Layout (every landscape window)

Tuned for landscape phones (667×375, 844×390 — address bars and notches included), tablets (1024×768, 1180×820), laptops (1366×768, 1440×900) and big monitors (1920×1080, 2560×1440, 3440×1440). Portrait is unchanged (see Intentional Design Decisions).

- **One viewport source:** `ui/useViewport.ts` reads the visual viewport (falling back to `innerWidth / innerHeight` while pinch-zoomed) and listens to window `resize`, `orientationchange` and `visualViewport` resizes. `installViewportVars()` (called in `main.tsx` before the first render) writes `--app-w`, `--app-h`, `--ui-scale` and `--hud-frame-left / -right` on `<html>`. `html, body, #root` and every full-screen layer use `100dvh` / `100dvw`, so a sliding mobile address bar never clips the bottom. `index.html` sets `viewport-fit=cover` so `env(safe-area-inset-*)` works on notched phones.
- **`--ui-scale`** = `uiScaleFor(w, h)` = `clamp(0.68, min(w / 1440, h / 900)^0.6, 1.22)`: 0.68 on 667×375 / 844×390, 0.815 on 1024×768, 0.909 on 1366×768, 1 on 1440×900, 1.116 on 1080p, 1.22 on 1440p and 3440×1440. Derived tokens (`theme.css` `:root`): `--ui-text-scale` = clamp(0.9, s, 1.2) for text-heavy surfaces (menus, toasts, popovers, hover labels — mirrored by `uiTextScaleFor`), `--ui-card-scale` = clamp(1, s, 1.2) for mini-game cards and modals (they keep their own short-screen layouts and only grow on big monitors), `--fs-*` / `--sp-*` fluid type & spacing, `--modal-max-w` / `--modal-max-h` (≤ 94dvw, 100dvh − 16px).
- **HUD clusters scale from their own corner** with `transform: scale(var(--ui-scale))` (hit-testing follows): `.ows-hud-header` (← Title / emblem / weather, the floor name, ← Back + room name), the centred pouch, `.ows-hud-corner` (Settings + Mute), and the Vitality medallion (never below 0.74 so its captions stay legible). Insets are `--hud-top / -bottom / -left / -right` = max(16px × scale, the safe-area inset), plus `--hud-frame-*`: `hudFrameInsets()` pulls the corners in on windows wider than 2.2 : 1 and hugs the painting when the stage leaves soft side bands (scenes publish their stage with `useHudStageFrame` / `onStageChange`). Tooltips inside the scaled HUD, toasts (below the HUD row, `--hud-row-bottom`), floating menus and the Settings popover use the readable text scale.
- **Every scene uses `fitStage`:** the rooftop (Pixi), Floors 1–4, room interiors, the lift and the push-in from a floor. The safe area is never cropped, a blurred dimmed copy fills any band (no black bars), and props, hotspots, shadows, hover tags and menus are positioned in the fitted stage rect, so nothing drifts on a live resize or when moving between monitors.
- **Floating menus:** anchored at normalized stage points (`stagePointToPx`), scaled from their pinned edge, kept below the measured top HUD (`[data-hud-top]`) and above the bottom edge by `menuMaxHeight` / `menuShift`, and scrollable when taller than the room.
- **Overlays:** mini-game cards, the lift panel, About and *Replace existing shelter?* stay inside `--modal-max-w` / `--modal-max-h` (layout px divided by their scale), with safe-area padding. At ≤ 520px height each mini-game switches to its side-by-side layout, About puts the story and tips side by side, and the Title puts the wordmark beside its buttons. Verified in-browser (no card scroll, no clipped buttons) at 667×375, 844×390, 1024×768, 1180×820, 1920×1080 and 2560×1440.
- **Touch:** on coarse pointers, HUD pills / icon buttons / ← Back get an invisible ~40px tap area, mini-game × is 36px and card buttons ≥ 40px tall; on `hover: none` devices hover lifts don't stick after a tap.

---

## Architectural Rules

1. **Game simulation is decoupled from rendering and React UI.** Everything under `src/game/data/`, `src/game/engine/`, and `src/game/store/` has zero React imports. Swap placeholder art for illustrated layers without rewriting game logic.
2. **Renderer (`src/game/renderer/`) bridges game → PixiJS.** React components in `src/ui/` handle HUD, menus, and flow.
3. **Sound engine is a plain singleton module** (`soundEngine.ts`) — no React context, no heavy audio library.

---

## Current Shelter Screen Wiring

The game has pivoted from menu drawers to a **point-and-click illustrated scene** (Old Apartment Terrace is the active vertical slice). What is actually live in the shelter today:

| Piece | Wiring |
|-------|--------|
| `ShelterScreen.tsx` | Mounts `ShelterCanvas`, a **← Title** button + shelter name, the centered Found Materials Pouch (all 7: 🪵 🧵 🌱 💧 🔩 🪨 🍅, pulsing on gains, with instant `.ows-pouch-tooltip` parchment pills on hover/focus), the bottom-left `VitalityDialHud`, and mutually exclusive contextual overlays (`PropActionMenu` for station primary actions / upgrades and `StationPopover` for Cooking/Mending — rendered inside `<main>` and anchored at **stage points** that are converted with the live stage rect from `onStageChange`, so a menu stays on its prop through live resizes). Drives the 1s real-time phase clock while mounted and unpaused. `PropActionMenu` calls `ShelterCanvas`'s imperative `performStationAction(stationId, action)`; `StationPopover` calls `cook(recipeId)` / `craftPerk(perkId)`; `SlotBuildMenu` (opened from an empty slot) lists `unplacedStations(stationState.slots)` and calls `buildInSlot(slotId, stationId)`. Starts the site ambience bed. Its `handleDoor` turns the `stairwell-door` hotspot into the `ElevatorPanelModal` (current = R) and returns `false`, so the scene unlocks and Cancel leaves the traveler free; a pick calls `onRide(to)` (App → `ride` screen). |
| `ShelterCanvas.tsx` | Reads `chosenSite`, `timeOfDay`, `dayPhase`, `unlockedUpgrades`, `lanternLit`, `reduceMotion`, `travelerGender` from the store and forwards them to the scene. Write-backs: **rewards** (`addResources()`; weeds/boxes cost `gatherStaminaCost()` stamina, farm/barrel yields are free), **build payments** (`spendResources()` + build stamina cost), **spends** (materials only — firewood, mending), **cooking** (`cookRecipe()`), **rest** (`restAtShelter()`), **sleep** (`sleepAtShelter(comfort)`, whose returned overnight `RegrowOutcome` is handed back to the scene), and **notices** (`pushNotice()` with an icon). Forwards door arrivals to `onDoor(doorId)` (returns whether the door leads somewhere). Checks material affordability live via `setCanAffordCallback()`. Each write calls `_save()`. On every station-state emit it caches crafted perks, sets the store's `strengthDriftFactor` (cloak) and mirrors `{ tiers, pending, fireLit, perks, planterReady, barrelReady, slots }` to `ShelterScreen`; it also forwards station-menu (`onStationMenuOpen`), slot-menu (`onSlotMenuOpen`) and station-open (`grill`/`sewing` + anchor) requests. |
| `shelterScene.ts` | Looks up configs via `getSceneConfig()` in `data/scenes/index.ts` (`terrace` only; other sites get the generic fallback walk area with no hotspots). **All normalized scene coords (props, hotspots, colliders, obstacles, walk bounds, entry/idle points) are relative to `stageRect`** — the on-screen rect of the backdrop from `fitStage()` (`engine/stageFit.ts`), recomputed at the start of every `layout()` — via `toPx()` / `toNorm()`; prop, traveler and glow sizes scale with `stageRect.height`. `fitStage` is a centred cover fit that never crops the scene's `safeArea` (Terrace: x 0.10–0.93, y 0.30–0.90 — slot-1 to the stairwell door, the tallest shelter roof to the front of the walk floor): it slides the framing first and only zooms out on unusually narrow shapes (e.g. 4:3 tablets, slightly), where a blurred, dimmed copy of the backdrop (`bgFill`) fills the bands. 16:9 windows are unchanged. Tweens lighting over 1.4s across `day` / `dusk` / `night`, fading in twinkling stars, drifting fireflies, and brighter fire/lantern light pools at dusk/night. Context-aware `sleep-shed` rests in `sit` pose during `day`/`dusk` and sleeps until Day `N+1` morning during `night` (passing `sleepComfort(shelterTier, perks)` and refreshing the farm/barrel ready flags). Clicking an empty build slot always opens the slot build menu. Clicking a station opens `PropActionMenu` when multiple actions or an upgrade are available, and executes directly for single-action maxed stations. Hover: parchment label, warm sprite tint and a 3% lift (`applyHotspotSpriteScale`, no lift under Reduce Motion); blueprints brighten. Door hotspots (`stairwell-door`) have no outline — just the label — and on arrival call `onDoor(id)`; if nothing handles it they fall back to their optional `message` toast and unlock. On the Terrace, `resolveSceneConfig()` applies the run's saved box & weed `spawns` (`withTerraceSpawns`). Entry: the traveler appears at the stairwell threshold, waits for the 220ms reveal + 280ms, then strolls to `idlePoint` at a fixed ~2s pace (`walkTo(..., durationMs)`). Fire visuals (flame tongues, coal bed, ember rate, smoke wisps, glow size/brightness/tint, crackle level) come from the `FIRE_TIERS` profile for the current `firepitTier`; lighting the fire spends 1 timber via the spend callback. Persists prop + station state through `engine/terraceState.ts`. **Responsive:** `resize(w, h, resolution)` refits the renderer (resolution = `rendererResolution(devicePixelRatio)`, ≤ 2×, re-applied when the window moves to a screen with another pixel density); `setUiScale(s)` sizes hover labels and reward text by the readable text scale and keeps labels below the scaled HUD row; `setStageCallback` reports the fitted stage whenever it moves; menu callbacks send normalized stage points. |

### Terrace Multi-Tier Stations

`TERRACE_STATIONS` (`data/scenes/terrace.ts`) defines 6 stations, each with a `baseTier` (0 = unbuilt) and an ordered `tiers[]` of `StationTierConfig` (`name`, `sprite`, `propScale`, `cost`, `collider`, optional `standOffset` / `restOffset`, flourish `effect`, optional dusk/night `glows` anchored in sprite space).
- **Fixed stations** (`shelter`, `firepit`) live on a fixed hotspot (`hotspotId`) and use a `buildStandOffset` for upgrades.
- **Slot-placed stations** (`planter`, `barrel`, `grill`, `sewing`) carry an `assignableId` (`AssignableStationId` = `'planter' | 'rain-barrel' | 'grill' | 'sewing'`, mapped to `StationId` by `ASSIGNABLE_STATION`). They live in whichever build slot the player chose.

| Station | Tiers → sprite (`SCENE_PROPS` key) | Where | Interaction |
|---|---|---|---|
| `shelter` (`sleep-shed`) | 1 `clothShed` · 2 `shedUpgraded` · 3 `shelterT3` | Fixed (0.30, 0.56), back-left corner | Rest / sleep; T2 lantern glow, T3 window + doorway glows |
| `firepit` (`firepit`) | 1 `firepitT1` · 2 `firepitT2` · 3 `firepit` | Fixed (0.49, 0.72), central hearth | Light (−1 🪵) / extinguish; `FIRE_TIERS` visuals |
| `planter` (`'planter'`) | 1 `planterT1` · 2 `planter` · 3 `planterT3` | Any build slot | Harvest `planterHarvest(tier)` once per day |
| `barrel` (`'rain-barrel'`) | 1 `barrelT1` · 2 `rainBarrel` · 3 `barrelT3` | Any build slot | Collect `barrelCollect(tier)` once per day |
| `grill` (`'grill'`) | 1 `grillT1` · 2 `grillT2` · 3 `grillT3` · 4 `grillT4` | Any build slot | Opens Cooking popover → `cook(recipeId)` |
| `sewing` (`'sewing'`) | 1 `sewT1` … 5 `sewT5` | Any build slot | Opens Mending popover → `craftPerk(perkId)` |

### Flexible Predefined Build Slots

`TERRACE_BUILD_SLOTS` holds 4 curated `BuildSlotConfig`s (`id`, `position`, `standOffset`, `collider` = empty-blueprint footprint), exposed as `ShelterSceneConfig.buildSlots`:

| Slot | Position | Stand offset | Zone | Legacy default |
|---|---|---|---|---|
| `slot-1` | (0.17, 0.68) | (+0.064, +0.02) | Sunny left parapet | `planter` |
| `slot-2` | (0.46, 0.54) | (0, +0.045) | Back parapet beside the shelter | `sewing` |
| `slot-3` | (0.62, 0.56) | (0, +0.045) | Back-right parapet | `grill` |
| `slot-4` | (0.76, 0.57) | (−0.056, +0.03) | Against the stairwell bulkhead | `rain-barrel` |

Stand offsets clear the widest tier collider (Hearth Kitchen, rx 0.05 / ry 0.026), so any station fits any slot. Positions are first-pass and due a composition polish pass (see backlog).

**State:** `ows_terrace_state.slotAssignments: Record<slotId, AssignableStationId | null>`, all `null` on a fresh run. The pure rules live in `engine/buildSlots.ts`:
- `placeStationInSlot()` refuses a taken slot, an unknown slot, or a station already placed elsewhere.
- `unplacedStations()` lists what an empty slot can still host.
- `reconcileSlotAssignments()` runs on every load and import:
  - it frees slots whose station isn't built;
  - it places built stations that have no slot into `LEGACY_DEFAULT_SLOT` (or the first free slot). This is how pre-slot saves and backups keep their exact layout.
- `parseSlotAssignments()` handles malformed data: in strict mode (backups) an unknown slot, an unknown station, a duplicate station or a non-object rejects the file; in lenient mode (localStorage) those entries are dropped.

**Scene:** slot hotspots have `type: 'slot'` and a `HotspotNode.slot` reference. `applySlot(hs)` renders an empty slot as a walkable floor blueprint labelled *"Build here"*. For a placed station it switches the hotspot's `type`/`station` to that station and calls `applyStationTier()`; the slot's own stand offset always wins over tier stand offsets. After that, the slot behaves exactly like the station (label, collider, Y-sort, `PropActionMenu`, harvest/collect/cook/mend), and `stationHotspot()` finds stations by `config.station`, wherever they stand.

**Flow:**
1. A click on an empty slot calls `emitSlotMenu()` → `ShelterScreen` opens `SlotBuildMenu`, listing the unplaced stations with their Tier 1 icon, name and cost (dimmed when unaffordable).
2. The pick calls `buildInSlot(slotId, id)`, which runs `requestBuildInSlot()`: the traveler walks to the slot's stand spot and plays the search pose with `playBuild()`.
3. `performBuild(…, slotId)` re-checks placement, so it never pays for a taken slot. Then it pays, writes `slotAssignments` and the tier, saves, and runs `applySlot(hs, true)` for the pop-in and the station's flourish.
4. When all 4 stations are placed, no empty slots remain.

The old station-level Tier 0 blueprint path (direct build or dimmed *"Craft …"* menu) is kept for any future fixed station that starts unbuilt; no Terrace station uses it now.

Flow (built stations): station click → `onHotspotClick()` routes single-action maxed stations straight into `walkToHotspotAndRun()`, while stations with multiple actions / available upgrades open the contextual `PropActionMenu` above the prop (title = current tier name; main action; *"Upgrade to {next name}"* + cost) → choosing an action calls `performStationAction(stationId, action)` → `requestBuild(stationId)` (or primary action). Upgrading walks to `buildStandOffset` (fixed stations) or the slot's stand spot → search pose + `playBuild()` → `onBuild(next.cost)` pays from the store → tier field written via `STATION_TIER_KEY` (a fresh T1 farm/barrel starts ready) → `applyStationTier()` swaps the hotspot's config/sprite/collider/stand spot/glows (or shows the floor blueprint at tier 0) with a pop-in + per-`effect` flourish (`playLogStack`, `playStoneSet`, `playWaterChime`, `playSew`, leaf burst). `restoreTerraceState()` applies every saved tier without animation. `emitStationState()` reports tiers/pending/fire/perks/ready flags to React. Hover labels come from `stationLabel()` (e.g. *"Harvest Herb Planter · +2 🍅 +1 🌱"*, *"Growing — ready tomorrow"*); the fire pit simply reads *"Fire pit"* since a click opens its menu (Light / Sit / Extinguish / Upgrade); empty slots read *"Build here"*. `cook()` / `craftPerk()` re-check tier, fire and materials, then play `playCook()` + steam or `playSew()` + sparkles with floating feedback. Locked recipes/perks name the tier they need via `stationRequirementHint()` (*"Needs Grill Counter"*) and show 🔒 in the popover — players never see `T1–T5`. Stations are independent of the 10 macro upgrades (no Cozy Index / milestone effect yet).

Rules live in `engine/stations.ts` (pure, unit-tested): `nextStationTier`, `planterHarvest` (+tier 🍅, +1 🌱 at T2+), `barrelCollect` (+tier 💧), `sleepComfort` (stamina target 75/90/100 by shelter tier, +10 with `warm-sheets`, cap 100; overnight strength loss 10 → 5 at T3), `gatherStaminaCost` (×0.7 with `mended-gloves`), `strengthDriftFactor` / `phaseStrengthDecay` (×0.5 with `cozy-cloak`), `recipeBlocker` / `applyRecipe`, `perkBlocker`. `applySleep()` never lowers stamina you already have.

### Randomized Box & Weed Layout

`generateTerraceSpawns(seed?)` (`engine/terraceSpawns.ts`, seeded mulberry32) builds a layout for the two wooden crates `crate-1/2` (one each of `boxes-intact` / `box-double`), 1–2 cardboard cartons in `cardboard-1..3` (distinct `WIND_CARDBOARD_VARIANTS`; `STARTING_CARDBOARD`) and `weeds-1..6` (two of each weed sprite), with 0.92–1.08× scale and random `flipX`. Every prop goes through one shared `placeProp()`. A spot is valid if it stays inside `TERRACE_SPAWN_RULES.bounds`, outside the parapet/bulkhead obstacles and the front-left low wall/steps, clear of the `keepClear` circles, and at least `rA + rB + gap` from every other prop. The `keepClear` circles cover:
- the fire pit and shelter (sized for their largest tier) plus their stand spots;
- every build slot, sized for the widest station any slot might host (r 0.1), plus the slot's stand spot;
- the shelter rest/build spot;
- the stairwell entry path and the door stand.

Distances are in stage-height units, with x scaled by the 1376/768 aspect. **Perimeter bias:** samples must fall within `perimeterBand` (0.1) of the rooftop perimeter, as measured by `perimeterDistance()`. That covers the back/left walls, the front edge, the right edge and the front-left steps. Boxes keep the tightest of 4 in-band samples (corners); weeds take the first in-band sample (natural scatter). A spot off the perimeter is used only if the edges are full; each prop tries up to 1,200 samples. Across 250 seeds, ≥ 99% of props land on the perimeter. The generator retries up to 12 layouts and falls back to `DEFAULT_TERRACE_SPAWNS`, which is re-composed around the new zones and itself valid. Box/weed label, reward, size and collider come from the sprite variant (`TERRACE_CRATE_VARIANTS` + `TERRACE_CARDBOARD_VARIANTS` = `TERRACE_BOX_VARIANTS`, `TERRACE_WEED_VARIANTS`); stand offsets face the open floor. `findSpawnProblems` requires both crates and all 6 weeds; cartons are optional.

`repairTerraceSpawns(spawns)` runs on every load and import (`normalizeTerraceState`). It keeps valid props in place and re-places only those that now overlap scenery or each other, keeping their variant, scale and flip. This covers layouts saved before the stations were recomposed.

### Wooden Crates vs. Cardboard Cartons

| | Wooden crates (`crate-1`, `crate-2`) | Cardboard cartons (`cardboard-1..3`) |
|---|---|---|
| Art | `boxes-intact` (→ `prop-boxes-cleared` once searched), `box-double` (→ dusty searched tint) | `cardboard-1/2/3` (+ legacy `box-single` parcel) |
| On the roof | Always — part of every layout from the start | Exactly when the id has a spawn (1–2 at the start, up to `MAX_CARDBOARD` = 3) |
| Searched | Stays, opened, still a collider; id kept in `searchedBoxes`; hover shows `searchedLabel` (*"Empty wooden crate (needs an axe to break down — coming soon)"*), no tint/lift, click → *"Needs an axe — coming soon"* | Fades away (`clearsWhenSearched`), its collider is freed at once and its **spawn is deleted** from `spawns` (a `null` layout is first materialized from `DEFAULT_TERRACE_SPAWNS`) — never listed in `searchedBoxes` |
| Overnight | Never moved or replaced (future: crafted axe) | Wind fills empty carton ids with fresh `WIND_CARDBOARD_VARIANTS` art |

The hotspot flags come from the variant via `terraceSpawnHotspot` (`clearsWhenSearched`, `searchedLabel` on `HotspotConfig`). `withTerraceSpawns` rebuilds every box & weed hotspot from the run's `spawns`, so a carton without a spawn has no hotspot at all.

**Migration (`normalizeTerraceState`):** layouts from before the split (`boxes-1..3`, any art) are converted by art (`migrateLegacyBoxes`: crate art → `crate-1/2`, the parcel → a carton) and their searched ids follow; a hand-placed `spawns: null` rooftop maps `LEGACY_DEFAULT_BOX_IDS` (`boxes-1` → `cardboard-1`, `boxes-2` → `crate-1`, `boxes-3` → `crate-2`). Any carton listed as searched loses its spawn; `searchedBoxes` keeps only crate ids. Strict mode (backups) also rejects carton art in a crate id and vice versa.

### Overnight Regrowth

`regrowTerraceSpawns(state, weather = 'clear', rng?)` is pure and seedable. It starts from `DEFAULT_TERRACE_SPAWNS` when `spawns` is `null`. Each weather has its own, non-overlapping effect:

| Weather | Weeds (`WEEDS_REGROWN`, never more than were cleared) | Boxes |
|---|---|---|
| ☀️ clear | 1 | none |
| 🌧️ rain | 2–3 | none |
| 🍃 wind | none | 1–2 cartons (`CARDBOARD_BLOWN_IN`) into empty carton ids, up to `MAX_CARDBOARD` on the roof — never crates |

- Regrown weeds leave `clearedWeeds` and are re-placed via `placeProp()` with a fresh weed variant, scale and flip; blown-in cartons get a fresh carton variant at a perimeter spot.
- **Placement:** the moving prop's old spot is freed; every other spawn, including invisible cleared weeds, stays reserved (carried-off cartons have no spawn, so their space is free). The whole layout therefore always passes `findSpawnProblems`, and the 6-weed / 3-carton caps hold by construction.
- **Return value:** the new state plus `regrownWeeds` / `refreshedBoxes` (the cartons blown in). When nothing changed, the same object comes back.

Flow:
1. `ShelterScene.interactSleep()` calls `onSleep(comfort)`, which runs `store.sleepAtShelter()`.
2. On the Terrace, the store rolls the new morning's weather first, then runs `regrowStoredTerrace(weather)` (`engine/terraceState.ts`: read `ows_terrace_state` → regrow → save if changed). The morning toast (titled with the weather's emoji) leads with what the night did — clear: *"A fresh weed patch sprouted overnight."*; rain: *"Soft rain filled the barrel and sprouted extra weeds overnight."* (the barrel part only with a barrel built); wind: *"Gusty wind carried fresh boxes onto the roof overnight."* (*"…a fresh cardboard box…"* for one) — or the weather's own line (*"A gusty breeze sweeps the rooftop."*) when nothing changed, then the stamina (or rain-cup 💧) line. It returns the outcome.
3. The scene's `applyOvernightRegrowth()` adopts the new `spawns` / `clearedWeeds` / `searchedBoxes` and re-resolves the scene config. It replaces only the regrown hotspot nodes (or adds a node for a carton id that had none) via `createHotspotNode()`, popping them in once their art loads (instant under Reduce Motion).
4. The scene then refreshes the farm/barrel ready flags and saves.

### Live Rooftop Weather (Rain & Wind)

**Rules (`engine/weather.ts`, `data/modes.ts`):** `Weather = 'clear' | 'rain' | 'wind'`. Day 1 is always clear; each sleep rolls the next morning from the mode's odds (Cozy 50 / 25 / 25, Challenge 40 / 30 / 30). Saves and backups holding the old `'breezy'` / `'storm'` still validate (`SAVED_WEATHER_VALUES`) and migrate to `'wind'` (`normalizeWeather`). `WEATHER_INFO` holds each weather's label, emoji, HUD hint and morning line.

| Weather | Rooftop effect | Where |
|---|---|---|
| ☀️ Clear | Calm skies; 1 weed patch regrows overnight, no boxes | `terraceSpawns.ts` |
| 🌧️ Rain | Barrel collects **+1 💧** (`barrelCollect(tier, weather)`; label *"Rain-filled — Collect · +N 💧"*, menu *"🌧️ Rain-filled — Collect +N 💧"*); **2–3** weeds regrow overnight and **no** boxes; the overnight cups still add +1–2 💧 (`morningWaterBonus`) | `stations.ts`, `terraceSpawns.ts`, store |
| 🍃 Wind | **1–2 cardboard cartons** blow in overnight (up to 3 on the roof; never crates) and **no** weeds regrow; every box searched that day (carton or crate) gives **+1** of one of its own materials (`windBoxBonus`), shown in the floating text (*"+3 🪵  +2 🔩  🍃 +1 🔩"*) | `terraceSpawns.ts`, `weather.ts`, scene |

**Visuals (`renderer/weatherLayer.ts`, owned by `ShelterScene`):** a container between the fx layer and the fireflies/labels, so it sits above props & traveler and below hover labels. Sprite pools are allocated only when the weather (or Reduce Motion) changes and fade in over ~0.9s; the per-frame update mutates a reused `WeatherFrame` (no allocations). Live weather plays on the Terrace only (`sceneWeather()`).
- **Rain:** 56 slanted, faintly cool-blue streaks (canvas-made 3px streak texture, drifting down-left at `RAIN_SLANT`, recycled at the top), 7 pooled floor ripple rings on the open walk area, and a cool misty wash. `overcast` (eased 0→1) also blends the phase lighting toward a cool grey (`OVERCAST_MUL`), lifts the multiply wash and dims the sun & screen glows — less at night so rainy nights stay dark and cozy. Reduce Motion: no streaks or ripples, just the wash.
- **Wind:** 26 soft golden-sage dust motes and 12 tumbling leaves/petals sweep left → right in gusts (`gust` = sin² pulse every ~9s); uncut weeds sway from their base (`WEED_SWAY` × gust). Reduce Motion: 8 still motes, no leaves, no sway.

**Audio (`setWeatherAmbience(weather | null)`):** a separate bus on the SFX channel with 500ms crossfades, reapplied on unlock / mute / volume. Rain = band-passed pink-noise patter + brown-noise roof body + soft droplet taps + an occasional parapet drip. Wind = low-mid pink-noise breeze with slow swell/sweep LFOs (+ a slower second swell) over a soft rumble, with occasional leaf rustles. `ShelterScreen` sets it from the store (`'clear'` off the Terrace) and clears it on unmount, so it fades out for lift rides and the indoor floors and back in on the roof.

**HUD:** `.ows-sky-chip` in the shelter header (☀️ Clear / 🌧️ Rain / 🍃 Wind) with a hover/focus tooltip of its effect. To keep the header clear of the centred pouch: the shelter name shows only above 1360px, the chip drops its label at ≤ 840px and the emblem hides at ≤ 760px.

### Scavenging Mini-Games (framework + seven games: Tic-Tac-Toe, Jigsaw, Dots & Lines, Find the Object, Connect the Wires, Safe Dial, Hit the Nail)

**Contract (`src/game/minigames/types.ts`, no React):** every puzzle component takes `MiniGameProps { mode: GameMode; title?: string; allowRetryOnLoss?: boolean; onComplete(result: MiniGameResult); onCancel() }` and reports `MiniGameResult { outcome: 'win' | 'draw' | 'loss' | 'cancelled'; mode }`. Difficulty follows the active shelter's `selectedMode`. The puzzle never touches resources — the host hotspot decides the reward.

**Closing (`src/ui/minigames/miniGameClose.ts`, shared by all seven cards):** × and Escape call `onCancel` only while a game is still in progress. Once it has finished they report the result exactly like **Continue** (`miniGameClose(finished, finish, onCancel)`), so a win's reward is never thrown away and a once-a-day floor loss can't be dodged by closing the card. `useMiniGameEscape(close)` registers a single window Escape handler that always sees the latest state.

**Tic-Tac-Toe engine (`src/game/minigames/ticTacToe.ts`, pure, seedable via `rng`):** `Cell = 'player' | 'cpu' | null` on a 9-cell row-major board; `applyMove(board, i, mark)` returns a new board or `null` (occupied, off-board or finished game); `evaluateBoard()` → `{ status: 'playing' | 'win' | 'draw' | 'loss', winningLine }` (win/loss from the player's view); `findWinningMove()`; `rankCpuMoves()` (memoized minimax over < 3⁹ positions — sooner wins score higher, ties shuffled by `rng`).
- `chooseCpuMove(board, 'cozy', rng?)`: a random open cell, except `COZY_SMART_CHANCE` (25%) of the time it takes a win or blocks.
- `chooseCpuMove(board, 'challenge', rng?)`: always wins, always blocks, otherwise the minimax best — with `CHALLENGE_SECOND_BEST_CHANCE` (15%) of the second-best cell while fewer than 4 marks are down, so a perfect player can sometimes fork.
- Measured over 2,000 seeded games (player first): a perfect player wins ~94% vs Cozy and ~7% vs Challenge (the rest draws, never a loss); a random player wins ~46% vs Cozy and ~0.3% vs Challenge.

**UI (`src/ui/minigames/TicTacToeGame.tsx`, live on Floors 1–4):** a `.ows-mg-overlay` / `.ows-mg-card` parchment card with bronze trim — title (default *"Tic-Tac-Toe"*), a Cozy / Challenge badge, × close; a status line (*"Your turn"*, *"Thinking…"*, *"You won!"* / *"A quiet draw"* / *"Almost — try again"*); a carved-wood `.ows-ttt-board` of parchment cells with hand-drawn SVG marks (terracotta X, sage O) that draw in; golden glowing winning cells plus a brushed gold strike. The player always starts; the opponent answers after 380ms (120ms under Reduce Motion, which also skips the draw-in animations). Sounds: `playHover` on open cells, `playClick` on every move, `playClaim` on a win, `playLocked` on a loss. When finished: **Play Again** (fresh board) or **Continue** (`onComplete`). × / Escape → `onCancel` while playing, or the result once finished (`miniGameClose`). Cells are labelled buttons (*"Row 2, column 3: empty"*), keyboard focus starts on the board, and the status is a polite live region.

**Jigsaw engine (`src/game/minigames/jigsaw.ts`, pure, seedable via `rng`):** `jigsawGridSize(mode)` → 3 (Cozy, 9 pieces) or 4 (Challenge, 16). `generateEdges(n, rng)` gives each piece `{ top, right, bottom, left }` of `1` (tab out), `-1` (blank in) or `0` (flat outer border); every inner seam is complementary (`right + neighbour.left === 0`). `buildPiecePath(edges, size)` traces a clockwise SVG path with classic cubic-Bézier knobs reaching `JIGSAW_TAB_DEPTH` (0.27 of the cell) outside the cell. `createJigsawState(mode, imageId, rng?)` → `{ gridSize, pieces, tray, slots }`: every piece starts in a Fisher–Yates-shuffled tray (an in-order shuffle is rotated, so it never looks pre-sorted) and the board starts empty. `placePiece(state, pieceId, slot)` → `{ state, result }`: `'placed'` locks the piece into its own slot (immutable update), `'wrong'` leaves the state untouched (the piece stays in the tray — no swapping, so a placed piece is always correct and can never move again), `'invalid'` for unknown ids, pieces already on the board or filled slots. Also `isSolved`, `countPlaced`, `getJigsawImage`, and `pickJigsawImage(excludeIds?, rng?, pool?)`, which skips excluded ids and, once everything is excluded, reopens the pool minus the latest id so a painting never repeats back-to-back.

**UI (`src/ui/minigames/JigsawGame.tsx`, not mounted yet):** reuses the `.ows-mg-*` card with a wider `.ows-jig-card` layout:
- **Header and status:** title (default *"Jigsaw Puzzle"*), a `5 / 9` progress pill, the mode badge and ×. The status line reads *"Unpacking the pieces…"*, then the drag/tap hint, *"Now tap the spot where it belongs"*, *"Not quite there — try another spot"*, and finally *"Piece by piece — complete!"*.
- **Board:** a recessed parchment `.ows-jig-board` in a dark-wood frame, drawn as one SVG (cell = 100 units). It shows dashed slot outlines, the placed pieces clipped from the full painting (`preserveAspectRatio="xMidYMid slice"`, so wide shelter scenes centre-crop) and a Cozy-only **Peek** ghost at 30% opacity. Invisible `.ows-jig-slot` buttons sit on top as tap targets.
- **Tray:** `.ows-jig-tray` beside the board holds the pieces, each its own padded SVG with a `<clipPath>`.
- **Controls:** pointer drag starts after 6px, captures the pointer and floats a `position: fixed` piece at board scale (moved through a ref, not re-renders). Dropping within 0.55 of a cell of the home slot snaps it in; otherwise the slot under the pointer is tried. A plain tap selects a piece (the click that follows a drag is suppressed) and tapping a slot places it.
- **Feedback:** a correct drop plays `playClick` and a gold shimmer; the last piece plays `playClaim` and fades in the whole painting over the cuts with a golden glow. A wrong drop shakes the piece. Once solved, the side column swaps the tray for the caption plus **Play Again** (a fresh painting; a module-level recent list rotates through the whole pool) and **Continue** (`onComplete({ outcome: 'win', mode })`). × / Escape → `onCancel` while playing, or the result once finished (`miniGameClose`).
- **Sizing:** `--jig-board = min(420px, 100dvh − 150px, 100dvw − 360px)`. Challenge uses a 4-column tray, so all 16 pieces fit without scrolling. At ≤ 520px height the board is `100dvh − 140px` with 58px / 46px pieces, which fits 667×375 and 844×390 landscape phones with no card scroll (checked in-browser at 667×375, 844×390 and 1024×768). Reduce Motion drops the shimmer, shake and reveal fade.

**Dots & Lines engine (`src/game/minigames/dotsAndBoxes.ts`, pure, seedable via `rng`):** `dotsGridSize(mode)` → 4 dots per side (Cozy: 3×3 = 9 boxes, 24 lines, never a tie) or 5 (Challenge: 4×4 = 16 boxes, 40 lines).
- **State:** `DotsState { size, h, v, boxes, turn, playerScore, cpuScore, lastMove }`. `h[row][col]` joins dot (row, col)–(row, col+1); `v[row][col]` joins dot (row, col)–(row+1, col). The player always starts.
- **Moves:** `applyEdgeMove(state, edge)` → `{ state, completedBoxes } | null`. Out-of-range, malformed or already-drawn lines return `null`, and the state is never mutated. Closing 1 or 2 boxes scores them for the mover and keeps the turn; otherwise the turn passes.
- **Outcome:** `dotsStatus()` → `'playing' | 'win' | 'loss' | 'draw'` from the player's view, once every box is claimed.
- **Helpers:** `allEdges`, `availableEdges`, `edgeBoxes`, `boxSides`, `boxesClosedBy`, `isSafeEdge` (draws no box's third side), `sacrificeCost` (boxes the opponent can then sweep by greedily taking every closable box).
- **`chooseDotsCpuMove(state, 'cozy', rng?)`:** closes an available box only `COZY_TAKE_CHANCE` (45%) of the time; otherwise draws any open line, which now and then opens a chain for the player.
- **`chooseDotsCpuMove(state, 'challenge', rng?)`:** always closes a box (preferring a double), else a random safe line, else the line with the smallest `sacrificeCost`. No double-dealing, so a player who controls the endgame can still win.
- **Measured over 400 seeded games:**
  - A casual player (always takes a free box, else random) wins ~87% on Cozy vs ~3% on Challenge.
  - A careful player (also avoids giving away a third side) wins ~97% on Cozy and ~18% (+8% draws) on Challenge.
  - A player who also sacrifices the smallest chain wins ~60% on Challenge.

**UI (`src/ui/minigames/DotsAndBoxesGame.tsx`, live on Floors 1–4):** reuses the `.ows-mg-*` card (`.ows-dots-card`, 400px wide).
- **Header and status:** title (default *"Dots & Lines"*), a `You 3 · 1 Camp` score pill, the mode badge and ×. The status line reads *"Your turn — draw a line"*, *"Extra turn!"* (1.2s after you close a box), *"Thinking…"* / *"Camp takes another turn…"*, then *"You won!"* / *"A quiet draw"* / *"Almost — try again"*.
- **Board:** one SVG (box = 100 units) on a framed parchment `.ows-dots-board` with espresso ink dots. Claimed lines draw in (terracotta for you, sage for the camp), and the camp's latest line glows. Claimed boxes get a soft wash plus a drawn X / O.
- **Hit areas:** every open line is a `role="button"` `<g>` whose hit area is the diamond between its two dots and the neighbouring box centres. The diamonds tile the board, so any tap lands on the nearest line. Each shows a dotted ink preview on hover or focus.
- **Turn flow:** the camp plays from a timer effect, one line per beat — 340ms, or 110ms under Reduce Motion, which also skips the draw-in animations — so chains play out step by step.
- **Sound:** `playClick` per line and `playBoxChime` (new, a crisp two-note chime) per closed box; on finish, `playClaim` for a win and `playLocked` for a loss.
- **Finish and keyboard:** when finished, **Play Again** (fresh board) or **Continue** (`onComplete({ outcome, mode })`). × / Escape → `onCancel` while playing, or the result once finished (`miniGameClose`). Enter / Space draw the focused line, and focus returns to the board when your turn comes back.
- **Sizing:** `--dots-board = min(330px, 100dvw − 56px, 100dvh − 210px)`. At ≤ 520px height the board is `100dvh − 140px` with the legend and buttons in a 150px column beside it. Checked in-browser at 667×375 and 844×390 (both modes, including the finished footer), 1024×768 and 1440×900: no card scroll.

**Find the Object engine (`src/game/minigames/findTheObject.ts`, pure, seedable via `rng`):**
- **Catalog:** `RUMMAGE_ITEMS`, 18 items `{ id, name, width, height }`, sized as fractions of the tray height. Each comes from a base art box (`art(w, h)`, thousandths of the tray height) × `RUMMAGE_ART_SCALE` (1.5), so the art and hit sizes share one source. The tray is `TRAY_ASPECT` 1.6 : 1, and item centres stay inside `TRAY_BOUNDS` (x 0.12–0.88, y 0.16–0.84).
- **`createRummageState(mode, rng?)`** → `{ mode, items: PileItem[], targetIds }`. Each `PileItem` is `{ instanceId, itemId, x, y, rotation, zIndex, isTarget, found }`. The rules come from `RUMMAGE_RULES`:
  - Cozy: 3 targets + 13 clutter = 16, with 1–2 covering pieces per target at 0.5–0.75 of its size away, targets tilted ±18°, clutter ±30°, and 3 scattered pieces tucked under the targets.
  - Challenge: 5 targets + 30 clutter = 35, with 3–4 covers per target sitting only 0.05–0.3 of its size away (nearly on top), targets tilted ±50°, clutter ±75°, and just 1 piece underneath. In-browser, clearing a Challenge pile by tapping took 20–54 taps, against about 4 for Cozy.
  - Target kinds are unique and excluded from the clutter pool, so there are no decoys. Clutter uses every remaining kind once before repeating (Challenge repeats, since only 13 kinds remain).
  - Targets spread at least 0.3 tray heights apart. Layers run bottom-up: tucked-under pieces, then targets, then a shuffle of covers and the rest, all with unique `zIndex`.
- **`movePileItem(state, id, x, y)`:** clutter only. It clamps to `TRAY_BOUNDS` and lifts the piece to `max + 1`, unless it's already alone on top. Targets, unknown ids and non-finite coordinates return the same state.
- **`nudgeClutterItem(state, id, rng?)`:** slides the piece `NUDGE_DISTANCE` (0.17 tray heights) toward the nearest tray edge that still has room, with a little perpendicular wobble and tilt, clamped and lifted.
- **`collectTargetItem(state, id)`** → `{ state, collected, complete }`. Clutter, unknown ids and already-found targets give `collected: false` and leave the state unchanged.
- **Also:** `isRummageComplete`, `countFound`, and `getNextHintTargetId` (the first unfound target in checklist order, or `null`).

**Art (`src/ui/minigames/rummageIcons.tsx`):** 18 hand-inked SVG drawings with espresso outlines in the sage / terracotta / brass / wood / parchment / tin palette. `RummageArt` draws an item in its base box (used in the pile); `RummageIcon` wraps it in a padded mini `<svg>` for the checklist. No image files.

**UI (`src/ui/minigames/FindTheObjectGame.tsx`, not mounted yet):** reuses the `.ows-mg-*` card (`.ows-rum-card`).
- **Header and checklist:** title (default *"Find the Object"*), a `2 / 3` found pill, the mode badge and ×. Beside the drawer, a status line (*"Drag or tap clutter aside, then tap what you're looking for"* → *"Found the Brass Key!"* → *"Found everything!"*) sits above the checklist: mini icon + name, ticked with a sage check and line-through once found.
- **Drawer:** a recessed wood-grain `.ows-rum-tray` holding a 1600×1000 SVG. Items are drawn in `zIndex` order, positioned with a CSS `transform` (translate + rotate, with a 260ms ease so nudges glide) and a soft drop shadow.
- **Controls:** each item is a `role="button"` `<g>` (Enter / Space act like a tap) with pointer capture. A drag of 6px or more moves clutter live via `movePileItem` (`playRummage` on grab); a tap nudges clutter (`playRummage`) or collects a target. Every item uses the same `grab` cursor, so hovering can't give targets away.
- **Feedback:** a collected target pops (scales up and fades) with a golden glint ring and `playBoxChime`, and the final one plays `playClaim`. Cozy's **Hint** button rings the next unfound target in a breathing gold circle for 1.6s; Challenge has no Hint.
- **Finish:** the side column swaps the Hint for **Play Again** (a fresh pile) and **Continue** (`onComplete({ outcome: 'win', mode })`). × / Escape → `onCancel` while playing, or the result once finished (`miniGameClose`).
- **Sizing:** `--rum-tray-w = min(600px, 100dvw − 280px, (100dvh − 120px) × 1.6)` with a 200px side column. At ≤ 520px height: `100dvw − 260px` and `(100dvh − 110px) × 1.6` with a 170px column, and Play Again / Continue sit side by side so Challenge's five-row checklist still fits. Checked in-browser at 667×375 and 844×390 (both modes), 1024×768 and 1440×900, before and after finishing: no card scroll, and every pile was cleared just by tapping.
- **Reduce Motion:** no nudge glide, pop, glint or ring pulse; found items simply disappear, and the hint ring is static.

**Connect the Wires engine (`src/game/minigames/connectWires.ts`, pure, seedable via `rng`):**
- **Wires:** `WIRE_SPECS` lists 6 wires, each with a colour and a symbol: terracotta ●, sage ▲, ochre ■, slate ◆, plum ★, teal ✚. `wireCount(mode)` → 4 (Cozy, the first four) or 6 (Challenge).
- **`createWireState(mode, rng?)`** → `{ mode, left, right, connected }`. Both strips are shuffled, and `right` is re-shuffled until it's a derangement of `left` (`straightAcross() === 0`, so every wire crosses). If the rng is stuck, a one-row rotation is used, which is always a derangement.
- **`tryConnectWire(state, leftIndex, rightIndex)`** → `{ state, matched }`. It joins the pair only when both terminals carry the same wire and it isn't already joined. Mismatches, repeats and out-of-range indices return the same state with `matched: false`.
- **Also:** `isWireConnected`, `countConnected`, `isWireBoxFixed`.

**UI (`src/ui/minigames/ConnectWiresGame.tsx`):** reuses the `.ows-mg-*` card (`.ows-wire-card`), with the panel beside a status column.
- **Header and status:** title, a `2 / 4` pill, the mode badge and ×. The status line reads *"Drag each wire to its matching terminal — or tap one, then its match"*, *"Now tap the matching terminal on the right"*, *"Those don't match — check the colour and symbol"*, then *"Wiring restored!"* with a single **Continue** (`onComplete({ outcome: 'win', mode })`). × / Escape → `onCancel` while playing, or the result once finished (`miniGameClose`).
- **Panel:** one SVG, 600 units wide and 96 + 68 × (n − 1) tall, with per-instance steel / brass gradients. It has a bevelled steel plate with rivets, scuffs and a *"JUNCTION · 230V"* stamp, plus two dark terminal strips. Each terminal has a status light (dim → glowing green when connected), an insulated colour stub with a highlight, a parchment symbol badge and a brass post. Joined wires are cubic-Bézier cords (`cordPath`, with sag growing with distance) drawn under the posts, in an ink, edge, fill and highlight stroke.
- **Controls:** each terminal is a `role="button"` `<g>` with a generous transparent hit row. Pressing a left terminal captures the pointer; past 6px it becomes a drag that draws a live cord to the pointer, snapping onto any unconnected right post within 46 units. Releasing there tries that pair; releasing elsewhere just retracts. A plain tap selects or deselects a wire (pulsing gold ring), and tapping a right terminal tries the pair. Enter / Space do the same. Focus starts on the first left terminal.
- **Feedback:** a correct pair gets a brass glint and a cord glow plus `playBoxChime`; the last one instead plays `playClaim` as the panel's frame lights up. A wrong pair shakes the left terminal, pulses the right post red and plays `playLocked`.
- **Sizing:** `width = min(520px, 100dvw − 260px, (100dvh − 120px) × ratio)` with a 180px side column. At ≤ 520px height: `100dvw − 230px` and `(100dvh − 104px) × ratio` with a 150px column. Checked in-browser at 1024×768 (Cozy) and 667×375 (Challenge, 6 wires, before and after finishing): no card scroll. Reduce Motion drops the ring pulse, glint, red pulse, shake and cord glow.

**Safe Dial engine (`src/game/minigames/safeDial.ts`, pure, seedable via `rng`):**
- **Dial:** `DIAL_NOTCHES` 40 (0–39), `TUMBLER_COUNT` 3. `createSafeState(mode, rng?)` starts at 0 and picks 3 targets, each at least `MIN_TARGET_SPACING` (6) notches from the start / previous target. The first direction (`'cw' | 'ccw'`) is random and then alternates.
- **`rotateDial(state, steps)`:** positive = clockwise (the number under the index counts down), negative = counter-clockwise. It returns `{ state, ticks }` with one tick per notch: `'tick'`, `'near'` (within `NEAR_RANGE` 2 of the target) or `'catch'` (inside the catch window). Near / catch only sound when turning the required direction. It also records the direction last turned (`turning`).
- **`lockTumbler(state)`** → `{ state, result }`:
  - `'set'` when turned the right way and within `catchWindow(mode)` (Cozy ±2, Challenge ±1); the third set is a win.
  - `'wrong-direction'` / `'wrong-position' { close }` count as wrong attempts. Cozy forgives any number; Challenge loses on the 3rd (`maxWrongAttempts`, `attemptsLeft`).
  - `'not-turned'` (Set pressed without turning since the last set) is ignored without a penalty; `'invalid'` once finished.
- **Also:** `wrapNotch`, `dialDistance`, `currentTarget`, `requiredDirection`, `tickAt`.

**UI (`src/ui/minigames/SafeDialGame.tsx`, not mounted yet):** reuses the `.ows-mg-*` card (`.ows-safe-card--cozy|challenge`), title default *"Old Safe"*.
- **Visuals:** a dark-slate steel plate in a wood rim, with 3 tumbler pins on top (grey → glowing green; the active one ringed in brass) and a brass SVG dial: 40 notches, numbers every 5, a knurled knob and a fixed brass index triangle. A small readout shows the current number. A side column shows *"Tumbler n of 3"*, the direction (*↻ Clockwise* / *↺ Counter-clockwise*), the status line and, in Challenge, the tries left.
- **Controls:** pointer-drag around the dial (angle accumulated into notch steps); hold-to-repeat ↺ / ↻ buttons (320ms delay, then every 90ms); ← / A and → / D to turn; Space / Enter or **Set** to lock in.
- **Feedback:** `playDialTick('tick' | 'near' | 'catch')` per notch — a crisp tick, a deeper resonant tick near the target and a heavy clunk on it, all respecting the SFX volume. For muted / low-volume players the catch also gives the dial a micro-shiver and a warm glint on the ring: clear in Cozy (2.4px, 0.85), very faint in Challenge (0.7px, 0.22) so listening stays primary. Wrong lock-ins show *"So close…"* / *"Not this number…"* (Cozy) or *"Wrong number"* (Challenge), or the wrong-direction hint, and play `playLocked`.
- **Finish:** all pins green, the plate glows, `playSafeOpen()` latch chime, *"Safe unlocked!"* + **Continue**. A Challenge loss reads *"The dial jammed"* (plus *"— try again tomorrow"* with `allowRetryOnLoss={false}`, which also hides **Play Again**).
- **Sizing:** dial `min(240px, 100dvh − 170px, 100dvw − 330px)` with a 196px side column; at ≤ 520px height `100dvh − 162px` with a 176px column and no key legend. Checked in-browser at 667×375, 844×390, 1024×768 and 1440×900, both modes: no card scroll. Reduce Motion drops the shiver and dial / pin transitions (the glint stays as a plain fade).

**Hit the Nail engine (`src/game/minigames/hitTheNail.ts`, pure, seedable via `rng`):**
- **Zones:** `randomZone(mode, rng, avoid?)` — width `zoneWidthRange(mode)` (Cozy 24–28%, Challenge 14–17% of the bar), kept `ZONE_MARGIN` (6%) from both ends; each new zone's centre lands at least 0.2 from the previous one (falling back to the far side if the rng is stuck).
- **Pointer:** `markerAt(elapsedMs, sweepMs)` is a triangle wave returning `{ pos: 0..1, dir: 1 | -1 }`. `sweepMs(mode, nail)`: Cozy 1400ms on every nail; Challenge 1150ms, then 950ms on nails 2 and 3.
- **`strikeNail(state, marker, rng?)`** → `{ state, result }`: `'hit'` (inside the zone, edges inclusive) drives the nail and moves the zone (win after `NAIL_COUNT` 3); a miss is `'early'` or `'late'` depending on which side of the zone the pointer is and which way it's moving. Cozy allows unlimited misses; Challenge loses on the 3rd (`CHALLENGE_MAX_MISSES`, `missesLeft`). A NaN pointer or a finished game → `'invalid'`.

**UI (`src/ui/minigames/HitTheNailGame.tsx`, not mounted yet):** reuses the `.ows-mg-*` card (`.ows-nail-card`).
- **Visuals:** one SVG board (400×190): a weathered plank (top face + grained front face), 3 rusty iron nails (shafts clipped at the wood surface, so driven nails sit flush) and a hand-drawn iron hammer resting 28° raised above the active nail. Below it an HTML timing bar: a dark wood track, a green sweet spot and a brass pointer moved by `requestAnimationFrame` straight on the DOM (no re-render per frame; the loop stops when the game ends or the card unmounts).
- **Controls:** click / tap the board or **Strike**, or Space / Enter.
- **Feedback:** a swing freezes the pointer; impact lands at 120ms (instantly under Reduce Motion). A hit plays `playNailClang()` (metallic clang + wood thud), puffs dust, drives the nail flush and moves the hammer and a fresh zone to the next nail. A miss plays `playNailTink()`, rattles the nail and shows *"Too early"* / *"Too late"*. Challenge shows *"· n misses left"*.
- **Finish:** `playNailFinish()` warm chord and *"Secured!"* + **Continue**; a Challenge loss reads *"Too many misses"* (*"— try again tomorrow"* when retry isn't allowed).
- **Sizing:** board `min(440px, 100dvw − 72px, (100dvh − 210px) × 2.1)`; at ≤ 520px height `(100dvh − 192px) × 2.1`. Checked in-browser at 667×375, 844×390, 1024×768 and 1440×900, both modes: no card scroll. Reduce Motion skips the swing animation, rattle and dust and snaps the nail / hammer / zone moves.

**Live across Floors 1–4 (`BuildingFloorScreen.tsx` + `data/floors.ts`):**
- **Data (`FloorHotspot`):** `puzzle?: 'connect-wires' | 'tic-tac-toe' | 'dots-and-lines'`, `reward?`, `resetRule?: 'rain' | 'wind' | 'daily'`, `requiresTool?: 'axe'`, plus optional `puzzleTitle`, `repairedLabel`, `doneNotice`, `repairedNotice`.
- **Outcome rules (`allowRetryOnLoss={false}`):**
  - **Win:** `markStoredSpotRepaired(id)` records the spot in `ows_terrace_state`, `addResources` + `_save()` awards `reward`, and an `unlock` toast announces the loot. `f3-fusebox` stops sparking and reads *"Repaired Fuse Box"*.
  - **Draw:** keeps **Play Again** visible/enabled inside `TicTacToeGame` / `DotsAndBoxesGame` for immediate replay without locking the spot.
  - **Loss:** hides **Play Again**, shows *"Try again tomorrow"* with **Continue**, and calls `markStoredSpotFailedToday(id)` (`failedTodaySpots`); clicking the spot again today shows `"Locked for today — try again tomorrow"`.
  - **Axe gate (`requiresTool: 'axe'`):** `f2-boarded` and `f4-boarded` flare and toast `"Boarded shut with planks — needs an axe to clear (coming soon)."` without launching their pre-configured Tic-Tac-Toe puzzle.
  - **Bookshelf (`f4-bookshelf`):** kept on `"scavenge puzzle coming soon"` (reserved for Jigsaw Puzzle).
- **Overnight & weather resets (`applyFloorNightReset(state, weather)` → `resetFloorSpotsForNewDay(repairedSpots, weather)` in `terraceState.ts`, called inside `sleepAtShelter()`):**
  - Always clears `failedTodaySpots = []` and removes `'daily'` container spots (`f2-cupboard`, `f3-locker`, `f4-trunk`).
  - On `'rain'`, removes `'rain'` spots (`f3-fusebox` shorts out and sparks again) and notes *"Rain shorted out downstairs wiring."*
  - On `'wind'`, removes `'wind'` door spots and notes *"Strong wind slammed downstairs doors shut."* — and forgets the room interiors behind those doors (`roomLayouts`).
- **Persistence:** `TerraceState.repairedSpots: string[]` and `failedTodaySpots: string[]` default to `[]` on fresh runs and older saves; strictly validated in backups.

### Apartment Room Interiors (enter opened doors)

**Doors (`data/floors.ts`):** `FloorHotspot.enterable?: boolean` marks the 14 apartment room doors — `f1-apt-1a`, `f1-apt-1b`, `f1-side-door`, `f2-room-2a`, `f2-door-2b`, `f3-broken-door`, `f3-room-3a`, `f3-room-3b`, `f3-door-3c`, `f4-broken-door`, `f4-room-4a`, plus the axe-gated `f2-boarded`, `f4-boarded`, `f4-boarded-studio` (they become enterable automatically once the axe can open them). Cupboards, lockers, trunks, the bookshelf, the fuse box and the lift are not enterable. Door names are unchanged; `findEnterableDoor(floor, id)` and `floorSpotEnterLabel(spot)` (*"Enter · {label}"*) are the helpers.

**On the floor (`BuildingFloorScreen`, new `onEnterRoom` prop):** once an enterable door is in `repairedSpots`, its hover tag and aria-label read *"Enter · {name}"*. Clicking it plays `playDoorCreak()` and fades the hallway out over 280ms (instant under Reduce Motion) before `App` switches to the room — instead of the old "door stands open" toast. The enter check runs before the axe gate, so a boarded door only becomes enterable once it's genuinely open.

**Generator (`data/rooms.ts`, pure, seedable):**
- `RoomType = 'bedroom' | 'kitchen' | 'living' | 'study'`. Each `ROOMS[type]` has a name, its 1376×768 shell, a window-light box (for the dust motes) and five `RoomPropDef { id, label, src, aspect, baseScale, allowFlip, zones }`. `baseScale` is the prop's height as a fraction of the stage height at the back wall; the TV and safe never mirror.
- **Anchor zones** (built per shell by `zonesFor` from its measured floor line and back-wall edges): `back-left`, `back-center`, `back-right` (`back-wall`, depth 1), `left-mid` / `right-mid` (`side-wall`, depth 1.15), `center-floor` (`mid-floor`, 1.2, max height 0.3) and `front-left` / `front-right` (`corner`, 1.3, max 0.33). Each has a bottom-centre foot point, `depthScale` and small jitter. Side-wall spots under a window carry a `maxHeight` so only low pieces stand there (bedroom/study left 0.24, kitchen right 0.26, living left 0.17; living right 0.3 keeps the radiator visible).
- **`generateRoomLayout(doorId, rng?)`:** picks a room type and a target of 3–5 props; shuffles the pool and places each on a free compatible zone (fits `zones` and `maxHeight`), with jitter and an optional mirror. A placement is skipped if it clashes with one already placed (same depth and > 8% side-by-side overlap, or a front piece hiding > 45% of one behind it); up to 24 attempts keep the fullest result, with a back-wall fallback that guarantees 3. Props are sorted by foot `y` (back to front). Measured over 4,000 seeds: an even spread of all 4 types and 3 / 4 / 5 props, never off the stage.
- **`parseRoomLayout(v, doorId)`:** strict validation of a saved layout (props from that room's pool, unique props and zones, unit-range numbers, boolean `flipX`), re-sorted. `roomSafeArea(layout)` returns the back wall plus every placed piece, for `fitStage`.

**Persistence (`terraceState.ts`):** `TerraceState.roomLayouts: Record<doorId, GeneratedRoomLayout>`, `{}` on fresh runs and older saves. Loading keeps only rooms whose door is still in `repairedSpots` (lenient loading drops damaged entries; strict backup validation rejects them). `storedRoomLayout(id)` / `storeRoomLayout(id, layout)` (only for an open door, never overwriting). **`applyFloorNightReset(state, weather)`** wraps `resetFloorSpotsForNewDay` + clearing `failedTodaySpots` and also deletes the `roomLayouts` of every re-locked door — `sleepAtShelter()` now uses it, and `shelterScene.applyOvernightRegrowth` copies `roomLayouts` alongside `repairedSpots` so the rooftop's own save can't resurrect them. So a room stays the same all day; once wind slams its door shut, reopening it reveals a new room.

**Screen (`ui/ApartmentRoomScreen.tsx`, props `floor`, `doorId`, `onBack`):**
- **Stage:** the same `fitStage` + blurred-fill framing as the floors, using `roomSafeArea`. The stage stays veiled until the shell and its props have loaded, then fades in.
- **Layers (back → front):** the shell (6px overscan) → furniture buttons (z-ordered by foot `y`, each with a warm-sepia elliptical contact shadow under its base, `closest-side` radial gradient, darker toward the centre) → window-light dust motes (`MOTE_COUNT` 16, drifting and fading, inside `room.light`) → time-of-day wash (`ows-room--day` soft-light gold, `--dusk` amber multiply, `--night` blue-slate multiply) → weather tint (`--rain` grey-blue overcast, which also softens the day glow and dims the motes; `--wind` faint grey) → warm edge vignette → the hovered prop's name tag (above the wash so it never gets tinted).
- **Parallax:** pointer moves (mouse/pen only) set `--room-px` / `--room-py`; the shell, furniture and dust shift by up to 4 / 7 / 10px. Reduce Motion disables it, the hover lift, glows and transitions, and freezes the dust as faint still specks.
- **Props:** `<button>`s labelled with the player-facing name (`aria-label`, hover/focus tag); hover lifts the piece 4px with a warm glow. Clicking plays `playClick`, flares it and toasts *"You inspect the {name} — searching inside rooms is coming soon."*
- **Header:** *"← Back to Floor N"* plus *"{door name} · {room name}"*. Back and Escape (ignored while any `[role="dialog"]` is open) play the door creak, fade out over 280ms and return to the hallway.
- **Audio:** `setRoomTone({ weather, phase })` fades in a muffled interior room tone on the SFX channel (still-air brown noise, all outside sound through a 1.3kHz low-pass): rain = soft patter + drops on the pane, wind = a slow draught, clear days = faint birds, plus an occasional settling creak. `setRoomTone(null)` on leaving. Re-applied on unlock / mute / SFX volume; Title music and UI sounds are untouched.

**Routing & refresh (`App.tsx`, `resumeLocation.ts`):** a `room` screen with `roomDoor` state. `ResumeLocation` gains `{ screen: 'room', floor, doorId }`; `parseResumeLocation(raw, site, isDoorOpen)` resumes the room only if it's an enterable door on that floor that's still open (App passes `isSpotRepaired(readStoredTerraceState(), id)`), otherwise the floor outside it.

Verified in-browser: entering Apartment 1A (study, 5 pieces), the same room after a refresh, hover tag + inspect toast, day / dusk / rainy-night washes, all four room types, framing at 1280×720 and 667×375 (every piece on screen), parallax on and off under Reduce Motion, Back and Escape, and a refresh inside a re-locked door landing on its floor.

### The Old Elevator: Floor Picker, Lift Rides & Apartment Floors

**Data (`data/floors.ts`, pure, unit-tested):**
- `BuildingFloorId = 1 | 2 | 3 | 4 | 'R'`.
- `BUILDING_FLOORS` maps floors 1–4 to `{ name, backdrop, hotspots }`. Hotspots are `{ id, label, rect (% of the 1376×768 painting), kind: 'lift' | 'scavenge', hasSparks? }`. All four paintings share one camera, so a single `LIFT` rect serves every floor.
- `ELEVATOR_STOPS` lists the panel buttons, top to bottom: R, 4, 3, 2, 1.
- Helpers: `floorBackdrop()` (R → `terrace-stage.webp`), `floorCaption()`, `liftTickSequence(from, to)` (inclusive, e.g. `R → 4 → 3`) and `liftRideTimeline(from, to)`.

| Floor | Painting | Hotspots (`id` — label) |
|---|---|---|
| 1 · Ground Floor · Lobby | `terrace-lobby.webp` | `f1-apt-1a` Apartment 1A (`tic-tac-toe`, wind) · `f1-apt-1b` Apartment 1B (`tic-tac-toe`, wind) · `f1-side-door` Side Doorway (`dots-and-lines`, wind) · `lift` |
| 2 · Residential Hallway | `terrace-floor-2.webp` | `f2-cupboard` Hallway Cupboard (`dots-and-lines`, daily) · `f2-boarded` Boarded Doorway & Debris (`requiresTool: 'axe'`, `tic-tac-toe`, wind) · `f2-room-2a` Sunlit Room 2A (`dots-and-lines`, wind) · `f2-door-2b` Cracked Door 2B (`dots-and-lines`, wind) · `lift` |
| 3 · Utility Corridor | `terrace-floor-3.webp` | `f3-broken-door` Unhinged Door (`dots-and-lines`, wind) · `f3-room-3a` Utility Door 3A (`tic-tac-toe`, wind) · `f3-room-3b` Utility Door 3B (`tic-tac-toe`, wind) · `f3-fusebox` Sparking Fuse Box (`hasSparks`, `connect-wires`, rain, +3 🔩 scrap) · `f3-door-3c` Dark Corridor 3C (`dots-and-lines`, wind) · `f3-locker` Metal Utility Locker (`tic-tac-toe`, daily) · `lift` |
| 4 · Skylight Landing | `terrace-floor-4.webp` | `f4-broken-door` Splintered Doorway (`dots-and-lines`, wind) · `f4-room-4a` Dark Hallway 4A (`dots-and-lines`, wind) · `f4-boarded` Boarded Doorway 4B (`requiresTool: 'axe'`, `tic-tac-toe`, wind) · `f4-boarded-studio` Boarded Studio Door (`requiresTool: 'axe'`, `tic-tac-toe`, wind) · `f4-trunk` Dusty Steamer Trunk (`dots-and-lines`, daily) · `f4-bookshelf` Hallway Bookshelf (reserved for Jigsaw) · `lift` |

**Ride timing (`liftRideTimeline`):**
- **Length:** `total = 2800 + (floors − 1) × 567ms` — 2.8s for one floor, 4.5s for four.
- **Intro:** `push` when leaving floors 1–4 (push-in on the floor painting, cut into the closed lift at 750ms, ride from 950ms). `step-in` when leaving R (the lift zooms in around the framed rooftop at 60ms, the doors shut at 450ms, ride from 700ms).
- **Swap:** the view behind the doors becomes the destination only once they're fully shut (`step-in`: 450 + 800 + 100ms).
- **Ticks:** spread evenly up to the arrival.
- **Outro:** arrive (ding) at `total − 1100`, doors open at +150, caption at +400, step out at +650. The parent fades over the last 400ms (`LIFT_FADE_MS` / `liftRideHoldMs` in `data/floors.ts`).
- **Steady schedule:** beats are scheduled once per ride; toggling Reduce Motion mid-ride never restarts them (footsteps read the setting at beat time; `ArrivalCutscene` keeps the timings it started with).
- **Skip keys:** Space / Enter / Escape skip only via `isCutsceneSkipKey()` — ignored while a control is focused or a dialog (Settings) is open, so Settings stays keyboard-usable during a ride.

**Components:**
- **`TerraceLiftCutscene`** (`fromFloor`, `toFloor`, `reduceMotion`, `skipped`) renders every ride on the shared `liftStage.tsx` pieces, on a lift stage fitted by `fitStage` with `LIFT_SAFE_AREA` (floor readout to doorway sill; soft blurred side bands on ultrawides). The push-in from a floor uses `stopSafeArea(fromFloor)` — the same framing as the screen it leaves, so the hand-off never jumps. The origin and destination paintings sit behind the doors (the rooftop keeps its warm glow), with `startLiftHum` / `playLiftFloorTick` / `playLiftDing` / `playLiftDoorSlide`.
- **Ambience on arrival:** the rooftop at full level, floors at 0.3.
- **Arrival from the title:** `ArrivalCutscene` simply plays the `1 → R` ride.
- **`LiftRideScreen`** is the in-building shell: fade-out, the same skip rules, and a rooftop backdrop preload when heading to R.
- **`ElevatorPanelModal`** (`current`, `onSelect`, `onClose`) is a brass plate (`.ows-lift-panel`, `.ows-lift-btn`). The current floor's button is lit amber, disabled and tagged *Current*. The first selectable button gets focus. Cancel, an outside pointer-down or Escape closes it.
- **`BuildingFloorScreen`** (`floor`, `onRide`):
  - The painting on a safe-area stage (`fitStage` with `floorSafeArea(floor)` — the middle half of every hotspot stays on screen at any window shape; a blurred copy fills any band), with `.ows-lobby-spot` buttons per hotspot (hover/focus glow + name tag).
  - A scavenge click → `playLocked()`, a re-keyed glow flare, and the toast *"{label} — scavenging puzzle coming soon."*
  - The `lift` hotspot opens the panel (R rides home). The top-left header is just the floor title (`pointer-events: none`). The earlier 🛗 Elevator / ↑ Rooftop pills were removed as duplicates of the lift.
  - `hasSparks` hotspots get live electricity:
    - **Arcs:** four `ARCS` at the fuse panel's contacts, wire ends and door edge. Each is a jagged SVG arc (`.ows-arc`, a cyan glow stroke plus a white core) that double-flickers on its own 1.9–3.1s rhythm.
    - **Flash:** a cold-blue screen-blended flash on the box (`.ows-sparks__flash`), synced to the main arc.
    - **Embers:** five hot `EMBERS` (`.ows-ember`) that kick sideways (`--kick`) and fall.
    - **Reduce Motion:** none of it is rendered, and it's hidden by CSS as well.

**Routing (`App.tsx`):**
- Screens are `shelter` (R) → `ride` `{ from, to }` → `shelter` or `floor` (1–4).
- On the rooftop, `ShelterScreen` opens the panel from the stairwell door. On a floor, `BuildingFloorScreen` opens it from the lift.
- Arriving at R remounts `ShelterScreen`, so the traveler strolls out of the stairwell again.
- **Refresh resumes in place** (`engine/resumeLocation.ts`): the current location is written to `sessionStorage` (`ows_resume_location`) on every screen change and read once on boot. Title → Title, shelter selector → shelter selector, rooftop → rooftop, Floor N → Floor N, inside a room → that room (or its floor if the door has re-locked); mid-arrival lands on the rooftop and mid-ride at the ride's destination (cutscenes aren't replayed). Locations needing a run fall back to the Title without a claimed shelter (floors also need the Terrace). Because it's per tab, opening the game again later starts at the Title (Continue → rooftop). Audio unlocks on the first click as usual; the menu music only starts if that click is on the Title / shelter selector.

**While downstairs or riding:**
- `ShelterScreen` is unmounted, so the day clock and the rooftop ambience stop; the run is saved on unmount and the clock resumes on return.
- The rooftop state stays in `ows_terrace_state`; a refresh downstairs keeps you on the same floor (see above).
- Reduce Motion turns every push, slide and tremor into fades.
- The panel uses short stop names (*"Floor 2 · Hallway"*, *"Floor 1 · Ground Lobby"*) while each floor's header and arrival caption use its full name (*"Floor 2 · Residential Hallway"*, *"Ground Floor · Lobby"*) — intentional.

### Archived / Unmounted M1 Files (intentionally dormant — not broken wiring)

The M1 drawer-based loop is **paused on purpose** while gathering, day rhythm and visual upgrades are redesigned for the in-scene experience. These files and actions are kept compiling, typed and (for engine rules) unit-tested so they can be reused or ported; **do not delete them, and do not treat their missing call sites as bugs**.

| File / action | Status |
|---------------|--------|
| `src/ui/TopBar.tsx` | Unmounted. Day / time / weather / energy / Cozy Index HUD with Back + Reset Save. |
| `src/ui/UpgradePanel.tsx` | Unmounted. Only caller of `buildUpgrade`. |
| `src/ui/ScavengePanel.tsx` | Unmounted. Only caller of `goScavenging`. |
| `src/ui/SurvivalKitPanel.tsx` | Unmounted. Survival Kit + Field Journal relics. |
| `src/ui/ConfirmResetModal.tsx` | Unmounted. In-shelter Reset Save confirmation (was opened from `TopBar`). |
| Store `advanceTime` | No UI caller (Rest). |
| Store `sleepToNextDay` | No UI caller (Sleep → next day, weather roll, milestone checks). |
| Store `lightLantern` | No UI caller. |
| Store `buildUpgrade` / `goScavenging` | Called only from the dormant drawers above. |

Consequence: the 3-phase day cycle (`day`, `dusk`, `night`) and sleeping to advance `Day N+1` (plus day-survival milestone unlocks) are now active in the shelter scene via `restAtShelter()` / `sleepAtShelter()`, while the 10 macro upgrades and scavenging drawer remain dormant until their in-scene designs land.

---

## Asset Pipeline

**Asset URLs:** never hard-code `'/source/…'`. Every `public/` file is referenced through `assetUrl('/source/…')` (`src/game/engine/assetUrl.ts`), which prefixes Vite's `import.meta.env.BASE_URL` — `'/'` in dev and tests, `'./'` in the build — so the same build loads under `/One-Warm-Spot/` on GitHub Pages and at a root domain. `media.ts` (backgrounds, sprites, stage, props, UI art, cutscenes, jigsaw paintings), `rooms.ts` (shells & room props), `floors.ts`, `scenes/terrace.ts` and the optional menu-music loader in `soundEngine.ts` all use it. Already-complete URLs (`https:`, `data:`, `blob:`) pass through.

| Asset | Location | Format | Fallback |
|-------|----------|--------|----------|
| Shelter backgrounds | `public/source/backgrounds/bg-*.webp` | WebP, 1920×1080 recommended | Cozy CSS gradient per entry in `media.ts` |
| Traveler sprites | `public/source/sprites/{female,male}-{idle,walk,search,sit,sleep,reach,peek,fix}.webp` + `{female,male}-walk-{1..4}.webp` (each gender's frames share one canvas: 248×512 / 213×512) | Transparent WebP | Graceful skip if absent; the single `walk` still is used if the frames haven't loaded or Reduce Motion is on |
| Scene stages & props | `public/source/scenes/*.webp`, `public/source/props/*.webp` | WebP | Stage preloaded into Pixi `Assets` during the arrival cutscene; the scene stays veiled until it's decoded, then fades in (220ms). A failed load shows a neutral `#F5EFE4` base |
| Cutscene plates | `public/source/cutscenes/terrace-*.webp` (1376×768 lobby, floor-2/3/4 and lift frame; 508×680 door panel) | WebP (frame has a transparent doorway) | Dark backdrop behind layers. Used by every lift ride and as the four explorable floors |
| Room shells | `public/source/rooms/room-{bedroom,kitchen,living,study}-shell.webp` (1376×768) | WebP | Loaded only when a room opens (the stage stays veiled until loaded); referenced from `ROOMS` in `data/rooms.ts` |
| Room props | `public/source/props/rooms/prop-{room}-{id}.webp` — kitchen `stove, cupboard, pantry, fridge, table`; study `desk, cabinet, trunk, bookshelf, safe`; bedroom `bed, wardrobe, nightstand, dresser, suitcase`; living `sofa, table, tv, armchair, sideboard` (≤ 640px, aspect stored per prop) | Transparent WebP | Bottom-centre anchored on curated zones; a failed load just leaves that piece empty |
| Jigsaw paintings | `public/source/jigsaw/jigsaw-{01-crater,02-letter,03-campfire,04-couple,05-bed,06-clock,07-map,08-radio,09-windowsill,10-telescope,11-bicycle,12-bookshelf,13-bridge,14-tea,15-conservatory}.webp` (640×640) | Square WebP | Listed in `JIGSAW_IMAGES` with 4 bonus shelter backgrounds (centre-cropped). Never preloaded — the puzzle loads only its chosen painting and shows *"Unpacking the pieces…"* until it's ready (a failed load still lets the puzzle open) |
| Menu music | `public/source/audio/music-menu.mp3` (optional, **not shipped**) | MP3 (looping) | Procedural warm-pad chord loop — **currently the active menu music** |
| UI & shelter foley | Procedural (Web Audio) | — | Always available, 0 KB (includes campfire, rummage, weed snip, sleep, build taps, log stack, stone set, water-drop chime, harvest, cook, sew, lift hum / door slide / floor tick / ding) |
| Site ambience | Procedural (Web Audio) | — | 9 musical soundscapes (birdsong, chimes, drips, creaks, surf…), 350ms crossfade |

---

## Deployment (GitHub Pages — temporary test host)

- **Live URL:** https://zayvk.github.io/One-Warm-Spot/ — for testing builds on phones, tablets and other screens.
- **Workflow:** `.github/workflows/deploy-pages.yml` runs on every push to `main` and on manual *Run workflow* (`workflow_dispatch`). Job `build` (ubuntu-latest, Node 22, npm cache): `npm ci` → `npm run build` (`tsc -b` + `vite build`) → `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3` (`path: dist`). Job `deploy`: `actions/deploy-pages@v4` into the `github-pages` environment. Permissions `contents: read, pages: write, id-token: write`; `concurrency: pages` with `cancel-in-progress`.
- **One-time setup:** repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- **Sub-path safety:** `vite.config.ts` uses `base: './'`, so `dist/index.html` and its chunks load with relative URLs (`./assets/…`, `./favicon.png`), and `assetUrl()` resolves every game asset against the same base. Verified by serving `dist/` at `/One-Warm-Spot/` (`npx vite preview --base /One-Warm-Spot/`): Title → Shelter Selector → lift arrival → rooftop all load with no failed requests, backgrounds / sprites / props / cutscenes from `/One-Warm-Spot/source/…`.
- **Local & future hosts unchanged:** `npm run dev` still serves at `/`; the same `dist/` deploys as-is to a root domain (Cloudflare Pages / Vercel). There is no client-side routing (screens are app state + `sessionStorage`), so no 404 fallback page is needed.
- **Storage:** saves live in the host origin's `localStorage` (`zayvk.github.io` is shared with the account's other Pages sites; the game's keys are prefixed `one-warm-spot-` / `ows_`). A save on the Pages build is separate from `localhost` — use Export / Load Backup to move a run between them.

---

## Save System

- **Run save:** `localStorage` key `one-warm-spot-save`, `SaveState` **version 4** — day, timeOfDay, energy, weather, chosenSite, selectedMode, travelerGender, resources (7 incl. `food`), unlockedUpgrades (built upgrade IDs), kitCollected, lanternLit, discoveredRelics, stats snapshot, timestamp. `food` was added without a version bump: validation lets it be absent (`LATER_RESOURCE_IDS`) and migration fills `food: 0`.
- **Fresh-run materials:** `chooseSite()` uses `freshRunResources(mode)` — the ⚠️ `GENEROUS_TEST_POOL` (`40🪵 15🧵 10🌱 8💧 20🔩 16🪨 6🍅`) while `TEST_MODE_GENEROUS_START` is `true` (`data/modes.ts`), otherwise `startingResources(mode)`. A balance test keeps pool + rooftop ≥ every station tier + every perk + 3 fires + each recipe once.
- **Strict validation (`findSaveProblem` / `validateSave` / `parseSaveText`)**: rejects payloads with a friendly, player-facing reason — unreadable JSON, missing/unknown/future `version`, non-integer or out-of-range `day`, unknown shelter / mode / traveler / time of day / weather, negative or fractional materials, damaged upgrade/relic lists, flags or stats. Imports over 512 KB are refused.
- **Migration (`migrateSave`)**: v2 → v3 maps the legacy `'tarp-pitched'` flag onto `shell-1` and fills day-loop defaults; v3 → v4 adds `weather: 'clear'` and `discoveredRelics: []`. Unknown or orphaned upgrades (tier 2 without tier 1) and unknown relics are dropped, materials are capped at storage limits, and each clean-up is reported as a warning (shown after import). Migrated saves are re-written on load.
- **Persistent progress:** `localStorage` key `one-warm-spot-progress` — `PlayerStats` (`maxDaysSurvived`, `totalUpgradesBuilt`, `totalExpansionsBuilt`) + already-announced unlocks. Survives starting a new shelter so unlocked sites stay claimable; pre-v3 players are seeded from their existing save.
- **Terrace prop state (separate key):** `localStorage` key `ows_terrace_state` — `{ fireLit, searchedBoxes, clearedWeeds, shelterTier, firepitTier, planterTier, barrelTier, grillTier, sewingTier, planterReady, barrelReady, craftedPerks, slotAssignments, spawns }` (`searchedBoxes` holds opened wooden crates only; a carton is on the roof exactly when it has a spawn), handled by `engine/terraceState.ts` through one shared `normalizeTerraceState(obj, strict)`. Lenient `parseTerraceState` (localStorage): legacy `builtProps` migrate to Tier 2 (`shed-upgrade` / `timber-shelter` → shelter, `herb-planter` → planter, `rain-barrel` → barrel), out-of-range/non-integer tiers fall back to the base tier, ready flags default to `true` for built farm/barrel, unknown/duplicate perks are dropped, `slotAssignments` are parsed and reconciled with the tiers (missing → built stations return to their legacy default slots; see Flexible Predefined Build Slots), missing/damaged `spawns` → `null` (hand-placed default layout), boxes from before crates & cartons split are migrated by art (see Wooden Crates vs. Cardboard Cartons), and missing/unreadable data is a fresh run with a newly generated layout; `loadTerraceState` writes the normalized state back so that layout survives refresh / Continue. It is **outside** the versioned `SaveState` in localStorage, but `.json` backups bundle it (see Export/Import). It is cleared by `chooseSite()` and `resetGame()` (fresh runs start at base tiers and a new layout).
- **Reset:** Currently reachable via **New Game / Start Fresh** on the Title screen and Shelter Selector (`ConfirmOverwriteModal`, with backup export). The in-shelter top-bar Reset Save (`ConfirmResetModal`, optional "forget milestones") is dormant with the rest of the M1 UI.
- **Export/Import (`engine/backup.ts`):** A backup file is the `SaveState` (which carries `stats`) plus `terraceState` (the full rooftop shape above). `exportBackup()` bundles the stored rooftop; `parseBackupText()` / `importBackup()` run the strict save checks, then `validateTerraceState()` (strict: a non-boolean flag, damaged list, out-of-range tier, broken layout, or a `slotAssignments` map with an unknown slot/station or the same station in two slots rejects the file with a friendly message; legacy `builtProps` / missing station fields / missing `slotAssignments` still migrate). Older backups load too — missing `food` becomes 0, and backups without `terraceState` start the rooftop fresh (with a warning if the run is on the Terrace). Restoring goes through the shared `restoreBackupFile()` (`ui/backupImport.ts`) → store `applyImportedBackup()`: writes/clears `ows_terrace_state`, applies the save, merges stats (max) into persistent progress, and bumps `sceneRevision` so a mounted `ShelterCanvas` rebuilds its scene from the restored rooftop. Available from **Title → Load Backup** (toast + immediate Continue) and **Settings → Export / Load Backup** (inline status). The overwrite/reset modals' "Export Backup" use the same full backup.

---

## Gameplay Rules (M1-A + M1-B — engine rules, UI currently dormant)

*Live overlap:* the shelter's real-time day cycle replaces the Day-loop/Energy rows in play. `sleepAtShelter()` still uses the **Weather** row: it rolls the weather, adds the Soft Rain 💧 bonus and names the weather in the morning toast (the live Rain & Wind effects are in *Live Rooftop Weather* above). It also uses the **Unlocks** row for days survived.

| System | Rule |
|--------|------|
| Day loop | `morning → afternoon → dusk → night`; each **Rest** step restores +15 energy. At night **Sleep** advances `day + 1`, resets to morning, refills energy to 100, rolls the day's weather and shows a *Morning of Day N* toast. |
| Energy | 0–100. Each upgrade costs energy (15–40); each scavenging trip costs 25 (Cozy) / 35 (Challenge). "Too Tired" until you rest. |
| Upgrades | 10 total in 4 categories. Tier 2 requires its Tier 1. Statuses: Built / Available / Need Materials / Too Tired / Locked. |
| Cozy Index | Sum of built upgrades' `cozy` values (all 10 = 100). Every 25 points adds +1 material to each scavenging trip. |
| Scavenging | Morning & afternoon only; each trip advances time one phase. 4 spots: Overgrown Highway (scrap, cloth), Fallen Pine Grove (timber, seeds), Crumbling Stone Creek (stone, water), Shattered Greenhouse (seeds, cloth, scrap). Primary materials ≥ 1 and a guaranteed trip minimum (4 Cozy / 3 Challenge). Materials cap at their storage limit. |
| Valley Relics | 25% (Cozy) / 20% (Challenge) chance per trip of an undiscovered keepsake (8 total), re-readable in the Field Journal. |
| Modes | **Cozy:** standard start, ×1 yields, weather clear 50 · rain 25 · wind 25. **Challenge:** ~60% start (🪵2 🔩2 🧵1 🪨1 🌱1 💧3), ×0.75 yields (floored), weather clear 40 · rain 30 · wind 30. Zero permadeath, zero raids in both. Claiming a shelter uses that shelter's mode. |
| Weather | Day 1 is always clear. **Soft Rain:** +1–2 💧 each morning (+1 with Rig Rain Collector). The old *Dust Squall* (which closed morning scavenging) was retired with the Rain & Wind update; scavenging is now only blocked by dusk/night or low energy. |
| Lantern | "Light the lantern" appears at dusk/night; once lit it glows every evening. |
| Unlocks | Starter: `terrace` only. `pipe` & `tree` are `comingSoon` (always locked, "Coming soon") while the Terrace is the single focus shelter. Farmhouse 2 upgrades · Country House 7 days · Cave 10 days · Bunker 1 expansion · Beachhouse 14 days · Island 4 upgrades. Days survived = `day − 1`. |

---

## Testing

- **Type-check:** the root `tsconfig.json` only holds project references (`"files": []`), so a bare `npx tsc --noEmit` checks nothing. Use `npx tsc --noEmit -p tsconfig.app.json` (app + tests) or `npx tsc -b`, which `npm run build` runs first.
- `npm test` (`vitest run`) — pure engine suites in `src/game/engine/__tests__/`:
  - `saveSystem.test.ts` — v2 → v4 and v3 → v4 migration, idempotent re-migration, pre-Food saves → `food: 0`, legacy `'breezy'` / `'storm'` weather loading as `'wind'` (current and v3 saves), clean-up warnings, 19 malformed-payload rejections with friendly messages.
  - `scavenge.test.ts` — seeded yield bounds per zone, Challenge ≤ Cozy for the same luck, Cozy Index bonus tiers, relic de-duplication, dusk/energy availability, storage caps, mode starting materials (Food starts at 0), weather rolls (only clear / rain / wind; Challenge a little less clear) and rain bonus; rooftop weather rules (windy box bonus = +1 of one of the box's own materials, none on other weather or an empty box; `normalizeWeather` legacy mapping).
  - `progression.test.ts` — all five upgrade statuses, prerequisite precedence, exact resource/energy deduction, Cozy Index totals, Terrace as the only Day 1 shelter, "coming soon" shelters never unlocking, milestone unlocks for days / upgrades / expansions and one-time announcements.
  - `dayCycle.test.ts` — phase clock, rest and default sleep math.
  - `terraceScene.test.ts` — `spendResources` exact deduction & refusal; `ows_terrace_state` parsing (legacy payloads → base tiers + default layout with legacy box ids mapped, legacy `builtProps` → Tier 2 stations, per-station tier ranges, perk filtering, ready flags only for built stations, exact round-trip of every tier/perk/flag + a custom `slotAssignments` layout + spawns in lenient and strict mode, pre-slot rooftops returning built stations to their old slots, slot data reconciled with what is built (duplicates/unknowns dropped, unbuilt stations freed, displaced stations moved to a free slot), damaged spawns incl. a missing crate or crate/carton art in the wrong id, fresh/unreadable data); wooden crates vs. cartons (an opened crate stays through save, reload and strict backups; a searched carton loses its spawn and a windy night can land a fresh one back in that id; older `boxes-1..3` layouts migrate by art with searched ids following; hand-placed rooftops lose only a searched parcel; `boxesSearched` legacy flag); balance with the leanest start — 2 crates + 1 carton (rooftop alone covers shelter & fire pit T2; the test pool + rooftop covers every tier, perk, 3 fires and each recipe).
  - `buildSlots.test.ts` — all 4 stations placed in every slot order (24 × 24 permutations) leave no empty slot; taken slots, double placement, unknown slots/stations are refused; legacy migration to default slots (or the first free one); unbuilt stations free their slot.
  - `floors.test.ts` — `liftTickSequence` up/down, single- and multi-floor (R → 3, 3 → 1, 2 → R, 1 → 2, 1 ↔ R…) and one-floor-per-step for every pair; `liftRideTimeline` length by distance (2.8s / 4.5s), intro per origin, and every beat in order for all 20 pairs (ticks ascending before arrival, the behind-doors swap only once the doors are shut); floor config integrity (floors 1–4 with their own paintings, expected hotspot ids, exactly one lift each, rects inside the painting, only the Floor 3 fuse box sparks, panel stops R→1, captions & rooftop backdrop).
  - `stations.test.ts` — every station upgrades one tier at a time to its max (3/3/3/3/4/5), agreed tier costs, farm/barrel yields by tier (+1 💧 from a built barrel on a rainy day), sleep comfort 75/90/100 (+10 sheets, cap) and T3 overnight loss 5, `applySleep` never lowering stamina, gloves (−30% gather stamina), cloak (half phase drift), perk & recipe blockers (tier, fire, ingredients), all 5 recipe effects, vitality cap and refusal without ingredients.
  - `terraceSpawns.test.ts` — 250 seeded layouts all pass `findSpawnProblems` (inside bounds, clear of walls/structures/entry path, no crowding) and keep clear of the fixed stations, every build slot and their stand spots; ≥ 95% of props on the perimeter band; valid hand-placed defaults; composition (both wooden crates, 1–2 distinct fresh cartons — both counts seen — and two of each weed) and scale range; per-seed determinism; validator flags crowded/off-floor props and a missing crate. `repairTerraceSpawns` leaves valid layouts alone and moves only overlapping props (keeping their art). `regrowTerraceSpawns` across 250 seeds: **rain** regrows 2–3 weeds (both counts seen, capped by cleared) and **0** boxes; **wind** blows in 1–2 cartons with fresh carton art only (both counts seen, ≥ 85% on the perimeter), **0** weeds, crates (even opened ones) untouched; windy nights fill up to exactly 3 cartons and then stop; **clear** regrows exactly 1 weed and 0 boxes; a full rooftop is untouched; seeded determinism per weather; the `spawns: null` default layout; 40 mixed-weather cleared-out nights stay valid within the caps.
  - `backup.test.ts` — backups from before Rain & Wind (`'breezy'` / `'storm'`) load as wind; backups from before crates & cartons split (searched parcel carried off, searched broken crates kept as `crate-1`); full backup round-trip (save incl. food, stats, rooftop incl. station tiers, slot assignments, perks, flags & layout), pre-Food / pre-station / pre-slot backups (food 0, legacy builds → Tier 2, built stations back in their old slots), older backups without `terraceState` (load + "starts fresh" warning), rejection of damaged rooftop fields (tiers, flags, lists, layout, the same station in two slots, unknown slot, unknown slot station, non-object slot map), and friendly errors for unreadable/invalid saves.
  - `stageFit.test.ts` — no safe area = plain centred cover; 16:9 windows identical to cover with no gaps; the Terrace safe area stays fully on screen from phone portrait to 3440×1440; ultrawide slides the framing instead of shrinking; gaps only on extreme shapes; the middle of every floor hotspot stays on screen on all 4 floors at every shape. **Responsive (667×375, 844×390, 1024×768, 1366×768, 1920×1080, 2560×1440, 3440×1440):** `uiScaleFor` values per window, monotonic growth, the tighter axis deciding, bogus sizes → 1; `uiTextScaleFor` bounds; the rooftop, all 4 floors and the lift keep their safe areas on screen and still cover one full axis; the lift push-in frames a stop exactly like its screen; stage points round-trip through the fitted rect; `hudFrameInsets` (none up to 2.2 : 1, pulled in on 3440×1440, hugging 32:9 side bands, ignoring 4:3 top / bottom bands); `rendererResolution` (DPR, capped at 2, bogus → 1).
  - `keepInView.test.ts` (`src/ui/__tests__`) — at all 7 target windows, menus of 90–520px anchored anywhere end up below the scaled top HUD row and above the bottom edge; tall menus are capped in layout px so their scaled height fits (and scroll); a minimum height on squashed windows; minimal shifts; a bogus scale counts as 1.
  - `ticTacToe.test.ts` (`src/game/minigames/__tests__`) — all 8 lines detected for either side, real-game rows/columns/diagonals, draw vs still playing; `applyMove` immutability and refusal of occupied / off-board / fractional cells and moves after the game ends; `findWinningMove`. Challenge, across every reachable position: always takes an immediate win, always blocks an immediate player win; beats a random player (< 5% player wins), never loses to a perfect player while still conceding the odd fork; seeded determinism. Cozy: only ever picks open cells; far more forgiving (a perfect player wins > 70% and > 3× as often as vs Challenge; a random player wins > 4× as often); still takes a win/block about a quarter of the time; refuses a full board.
  - `jigsaw.test.ts` (`src/game/minigames/__tests__`) — across 40 seeds per size, 3×3 and 4×4 edges are flat on every outer border and complementary on every inner seam (both tabs and blanks appear); `buildPiecePath` draws flat edges as straight lines and tabs/blanks outside/inside the cell; Cozy → 3×3, Challenge → 4×4; across 200 seeds per mode the tray holds all N² pieces, is never in board order and the board starts empty / unsolved (even with an rng that would leave the shuffle in order); seeded determinism; `placePiece` locks a correct piece immutably, leaves a wrong drop untouched, refuses moving a locked piece / filled or out-of-range slots / unknown pieces, and `isSolved` flips only on the final piece; the image pool (15 squares + bonus scenes, unique ids, `/source/…webp`); `pickJigsawImage` never returns an excluded id while others remain, reopens the pool minus the latest when all are excluded, and copes with a one-painting pool or an rng of ~1.
  - `dotsAndBoxes.test.ts` (`src/game/minigames/__tests__`):
    - **Board:** exact line / box counts (24 / 9 and 40 / 16) with unique lines.
    - **Moves:** a non-closing line passes the turn immutably; closing 1 box and closing 2 boxes at once score correctly and keep the turn; drawn, out-of-range, fractional and malformed lines are rejected without mutation; full games claim every line and box and the score matches the boxes.
    - **Outcomes:** win / loss / draw / playing; Cozy never ties while Challenge can.
    - **Challenge AI:** always closes a box (the double when available); prefers a safe line whenever one exists; when every line gives something away, picks a minimum-`sacrificeCost` line; `sacrificeCost` counts a whole 3-box corridor; seeded determinism; refuses a full board.
    - **Cozy AI:** only picks open lines; takes free boxes between 35% and 75% of the time; a casual box-grabbing player wins > 70% vs Cozy, < 15% vs Challenge, and over 3× less often against the Challenge AI on the same 3×3 board.
  - `findTheObject.test.ts` (`src/game/minigames/__tests__`):
    - **Catalog:** 18 distinct ids and names with sensible sizes.
    - **Pile:** across 100–200 seeds per mode,     Cozy has exactly 3 / 16 and Challenge 5 / 35 items, unique instance ids, and nothing pre-found. Targets are unique and never appear as clutter; every item sits inside `TRAY_BOUNDS` with a unique `zIndex`. Cozy clutter is all-different (13 kinds) while Challenge uses all 13 remaining kinds.
        - **Burial:** every target has at least one overlapping piece above it; Challenge averages ≥ 3 covers per target, more than Cozy, with > 1.5× the clutter tilt; targets sit in the lower layers (> 25 Challenge pieces above them). Seeded determinism.
    - **Moving:** `movePileItem` moves immutably, lifts to the top once (no endless climbing), clamps to both corners, and ignores targets, unknown ids and NaN. `nudgeClutterItem` stays in bounds, lifts the piece and travels at most about `NUDGE_DISTANCE`; a piece near the left wall goes left, one pinned in a corner comes back out; it ignores targets and unknown ids.
    - **Collecting:** clutter, unknown ids and repeats are rejected with the state unchanged; collecting every target in any order completes the pile; `getNextHintTargetId` walks the checklist and returns `null` once everything is found.
  - `connectWires.test.ts` (`src/game/minigames/__tests__`):
    - **Boxes:** Cozy has 4 and Challenge 6 colour + symbol wires on both strips (exact colour sets, all symbols distinct). Across 300 seeds per mode no wire runs straight across, even with a stuck rng. The shuffle varies across seeds and is deterministic per seed.
    - **Connecting:** `tryConnectWire` locks a match immutably and leaves the state untouched for mismatches, repeats and out-of-range terminals; the box is fixed only after the last wire.
    - **Floor data:** `f3-fusebox` is a live `connect-wires` puzzle paying 3 scrap.
    - **Persistence:** `repairedSpots` is empty on a fresh run; `withSpotRepaired` is immutable and idempotent. It survives a save round-trip; older saves load as `[]`, and lenient loading drops junk and duplicates.
    - **Backups:** they carry the list, older rooftops import as `[]`, and strict validation rejects a non-list or non-string entries.
  - `resumeLocation.test.ts` — every screen maps to its refresh destination (arrival → rooftop, ride → its destination), round-trips, Title fallback without a claimed shelter (floors need the Terrace), damaged data ignored. **Screen guard (`resolveScreen`):** no claimed shelter → Title; ride / floor / room on a non-Terrace run (e.g. after loading another site's backup mid-session) → shelter; an invalid room → its floor.
  - `safeDial.test.ts` (`src/game/minigames/__tests__`) — across 300 seeds per mode, 3 targets on the dial, each ≥ 6 notches from the start / previous one, with alternating directions; varied, seeded-deterministic combinations; a stuck rng still spaces targets; per-mode catch windows and attempt limits. Turning: cw counts down / ccw up with wrap-around; one tick per notch, `near` then a single `catch` on the target only when turning the required way. Lock-ins: three good sets win (and nothing works afterwards); Cozy catches at ±2 but not ±3, Challenge at ±1 but not ±2; the right number turned the wrong way fails; Set without turning is ignored at no cost; Cozy forgives endless wrong tries; Challenge jams on the 3rd (flagging near misses); inputs are never mutated.
  - `hitTheNail.test.ts` (`src/game/minigames/__tests__`) — across 400 seeds per mode, zone widths stay within Cozy 24–28% / Challenge 14–17% and fully on the bar; each new zone moves ≥ 0.2 away (even with a stuck rng); the pointer's triangle sweep and direction; Cozy's steady pace vs Challenge's faster later nails; three hits drive every nail and win; early / late from the pointer's side and direction (zone edges count as hits); Cozy never runs out of tries; Challenge loses on the 3rd miss even after progress; NaN pointers are ignored; inputs are never mutated.
  - `miniGameClose.test.ts` (`src/game/minigames/__tests__`) — × / Escape cancel while a game runs, but report the result once it has finished (regression for dodging a floor loss or losing a win's reward).
  - `assetUrl.test.ts` (`src/game/engine/__tests__`) — `'/'` keeps `/source/…`, `'./'` gives `./source/…`, `'/One-Warm-Spot/'` (with or without the trailing slash) gives `/One-Warm-Spot/source/…`; paths without a leading slash or with `./` never double up; `https:` / `data:` / `blob:` / protocol-relative URLs pass through; every background, sprite, prop, jigsaw painting and room shell / prop goes through the build base.
  - `rooms.test.ts` (`src/game/engine/__tests__`):
    - **Data:** 4 room types with their shell and 5 props each (paths, clean player-facing labels, unique zone ids); exactly the 14 apartment doors (incl. the 3 axe-gated) are `enterable`.
    - **Generator:** across 400 seeds, a valid room type with 3–5 unique props from its own pool, each on its own compatible zone (`maxHeight` respected, no mirrored TV/safe), fully on the stage, sorted back to front; no same-depth side-by-side overlaps (300 seeds); every type and count appears; deterministic per seed; copes with a stuck rng; `roomSafeArea` contains every piece.
    - **`parseRoomLayout`:** accepts and re-sorts a generated layout; rejects unknown rooms, foreign / repeated props or zones, out-of-range numbers and bad `flipX`.
    - **Persistence:** round-trips in the rooftop save (older saves → `{}`); rooms behind closed doors and damaged entries are dropped on load; backups carry them and reject damaged ones.
    - **Overnight:** `applyFloorNightReset` — wind re-locks doors and forgets their rooms, rain keeps them, nothing changes → same state; through `sleepAtShelter()` a windy morning clears the stored rooms; `storeRoomLayout` only stores for an open door and never overwrites.
    - **Resume:** `locationForScreen('room', …)`; resumes in the room while its door is open, falls back to the floor when it re-locked / is unknown / isn't a room door; needs a Terrace run and a real floor.
- **Lint:** `npx oxlint src` (0 warnings).
- **E2E:** `npm run test:e2e` (`playwright test`) — 28 scenarios driving the real game in **system Chrome** (`channel: 'chrome'`; `npx playwright install` is blocked by the corporate TLS proxy, so no bundled browser is downloaded). Playwright starts its own `vite` dev server on port 5180. Every test fails on any page error or `console.error`. Canvas clicks map normalized scene coords through the same `fitStage()` the scene uses; state is asserted from `localStorage`. Reports land in `playwright-report/` / `test-results/` (git-ignored).
  - `menus.e2e.ts` — title (Start / About / Load Backup, no Continue on a fresh browser), About + Escape, Settings sliders and a persisted Reduce Motion switch, mute toggle, shelter selector (only the Terrace claimable, locked section, Cozy/Challenge tabs, Female/Male, Back leaves no save).
  - `terrace.e2e.ts` — HUD (Day plaque, medallion, 7 pouch items, 9 spawned props); search a box (materials gained, can't re-search) and clear a weed; light the fire (−1 timber) → Sit / Extinguish; upgrade the fire pit from its menu; build all four stations in a scrambled slot order (the build menu shrinks 4→1), then Cook and Mend popovers; rest → dusk → night, sleep into Day 2 (morning toast), harvest the planter.
  - `elevator.e2e.ts` — door → floor panel (current floor disabled; Cancel / Escape / outside click close it); ride 4 → 3 → 2 → 1 clicking every scavenging spot (toast each), sparks only on Floor 3, day clock frozen downstairs, ride back to R; an unskipped ride arrives on its own; Settings opened mid-ride keeps Space/Escape for itself and the ride still lands on time.
  - `persistence.e2e.ts` — refresh resumes in place (rooftop with resources and a built slot, Floor 3, mid-ride → the destination floor, Title → Title) while a new tab starts at the Title with Continue → rooftop; Settings → Export Backup downloads `one-warm-spot-day1.json`, which loads in a fresh browser via Title → Load Backup with identical resources, slots and layout; a damaged file shows the friendly error; New Game over a save → Cancel keeps it, Start Fresh wipes it.
  - `responsive.e2e.ts` — a Reduce Motion (male traveler) run builds and rides with no sparks rendered. At 667×375, 844×390, 932×430 (landscape phones), 1024×768, 1180×820, 1366×1024 (tablets) and 2400×900: the pouch is one row clear of ← Title, the medallion, build menu, fire menu and elevator panel are fully on screen (menus below the pouch), and every Floor 2 spot is visible and clickable. A touch run (844×390, `hasTouch`) taps a build slot, the lift and a floor spot.

---

## Development Checklist

### ✅ Completed

- [x] Repository setup (Vite + React + TypeScript strict, PixiJS, Zustand, Vitest)
- [x] Cozy CSS token palette (sage/terracotta/sky)
- [x] Google Fonts: Yusei Magic (title) + Cinzel (alt)
- [x] Title Screen with Start / Continue / New Game / About
- [x] About Modal (frosted-glass, Escape-closeable)
- [x] 9 shelter sites across Cozy Mode (5) and Challenge Mode (4)
- [x] Shelter Selector with Cozy/Challenge mode tabs
- [x] Female/Male traveler picker with inline SVG silhouettes
- [x] Full-viewport BackgroundStage with 400ms crossfade & dimmed mode
- [x] Per-shelter hover background + image fallback gradients
- [x] Web Audio sound engine: menu music + procedural fallback, hover/click/claim/locked/footstep SFX
- [x] 9-site procedural hover ambience (wind, surf, canopy, cave drips, room hum, barn creak, etc.)
- [x] Floating AudioToggle (mute persisted in localStorage) + Settings popover (`SettingsPopover.tsx`)
- [x] Independent Music Volume (default 0.55) & SFX/Ambience Volume (default 0.70) sliders with smooth gain ramping
- [x] Reduce Motion accessibility toggle persisted in `localStorage` (respects `prefers-reduced-motion` default)
- [x] Settings quick Save Data row: schema-validated JSON export & import with inline feedback
- [x] Save-Overwrite safety modal (`ConfirmOverwriteModal.tsx`) with Cancel, Export Backup (.json), and Start Fresh
- [x] Pre-game UI polish: Title upper-sky placement with warm radial scrim, cozy button micro-interactions
- [x] Shelter Selector polish: compact single-row header, equal-height cards, 3/2/1 responsive breakpoints
- [x] Arrival Cutscene respects Reduce Motion (disables Ken Burns zoom & walking bob in favor of calm fades)
- [x] Lightweight in-engine Arrival Cutscene (~3.5s, Ken Burns zoom, walking traveler, skippable)
- [x] TopBar HUD (Day, site name, 6 resources, Reset Save)
- [x] localStorage autosave with JSON export/import helpers
- [x] `GAME_CONTEXT.md` and `DEV_STATUS.md` living documentation

### ✅ M1-A · Playable Day 1 Shelter View (completed)

- [x] **Known issue fixed:** ~~Separate `tarpPitched` flag~~ → tarp is upgrade `shell-1` in the 10-upgrade list, with safe save migration
- [x] **Known issue fixed:** ~~Pixi canvas never redrew on resize and leaked display objects~~ → `ResizeObserver`-driven resize/relayout, `destroy({ children: true })` for replaced objects and full app teardown on unmount
- [x] **Known issue fixed:** ~~Instant top-bar Reset Save~~ → confirmation dialog that resets and returns to the Title screen
- [x] Real painted shelter artwork in PixiJS (cover framing, fade-in, gradient fallback)
- [x] Smooth Time-of-Day lighting (golden morning, soft afternoon, amber-peach dusk, twilight night) + lantern halo
- [x] Upgrade markers with warm glows + Cozy-Index warmth layer that visibly transform the scene
- [x] Day / Time-of-Day / Energy loop with Rest, Sleep to Next Day and *Morning of Day N* toast
- [x] Survival Kit drawer (Canvas Tarp, Bedroll & Pack, Pocket Stove, Multi-Tool, Field Journal)
- [x] Upgrade Panel wiring all 10 upgrades by category (cost, energy, Cozy boost, status, Build / Repair)
- [x] Persistent milestone stats + real site unlocks with progress hints and unlock toasts (locked sites stay locked on Day 1)
- [x] Back to Title button in the shelter top bar (progress auto-saves)
- [x] Per-shelter ambience reworked into soft musical soundscapes (no white-noise hiss) + soft in-shelter ambience bed; respects mute & SFX slider

### ✅ M1-B · Scavenging, Modes, Weather & Tests (completed)

- [x] Surface Scavenging Loop — 4 valley spots, pure `runScavenge()` with guaranteed minimum yield + Cozy Index bonus, warm discovery lines, `ScavengePanel` with Expedition Result card and footsteps + chime audio cue
- [x] Valley Relics (8) found while scavenging, re-readable under the Field Journal in the Survival Kit drawer
- [x] Cozy vs. Challenge rules (`modes.ts`): starting materials, scavenge energy, yield multiplier, trip minimum, relic odds, weather table
- [x] Gentle daily weather (clear / breezy / soft rain / dust squall) with top-bar chip, rain water bonus and storm-closed mornings (fortified walls brave it) *(since simplified to clear / rain / wind — see Live Rooftop Weather)*
- [x] Strict save validation with friendly import errors + v2/v3 → v4 migration (weather, relics) and clean-up warnings
- [x] Vitest suite: 68 tests across save migration/rejection, scavenging & mode rules, upgrade eligibility/deduction and milestone unlocks

### 🚀 Active Milestone: M2 · Living Interactive Shelter

- [x] **M2 Vertical Slice:** Data-driven `ShelterSceneConfig` engine (`scenes/types.ts`, `scenes/terrace.ts`) for **Old Apartment Terrace**
- [x] **M2:** Real character pose sprites (`idle`, `walk`, `search`, `sit`, `sleep`) with consistent anatomical height scaling, pose-adapted shadows, and smooth crossfades across Selector and Shelter Scene
- [x] **M2:** Terrace interactive hotspots (toggleable Fire Pit with light/extinguish SFX, flickering PixiJS flames/embers/glow + campfire crackle, 3 scattered Box clusters, 6 Weed Patches with leaf particles, tucked Under-Shed sleep twilight/wake) + floor click-to-walk, elliptical prop colliders, Y-depth sorting (`zIndex`), and `localStorage` prop persistence (`searchedBoxes`, `clearedWeeds`, `fireLit`)
- [x] **M2:** Simplified floating shelter HUD (`ShelterScreen.tsx`) with top-left shelter title + centered enlarged Found Materials Pouch (with pulse animation)
- [x] **M2:** Synthesized shelter foley (`playFireLight`, `playFireDouse`, `setCampfireAudio`, `playRummage`, `playWeedCut`, `playSleep`, `playBuild`, `playWaterChime`)
- [x] **M2 · Terrace v2:** New stage with rooftop stairwell/lift bulkhead; traveler fades in and steps out of the ajar door; static `obstacles` (left parapet ellipse, bulkhead rect) keep walk targets off painted scenery
- [x] **M2 · Terrace v2:** Shabby cloth lean-to (`prop-cloth-shed.webp`) behind-left of the fire pit as the sleep spot (own collider; sleeper sorts just above the shelter so they lie on its bedding)
- [x] **M2 · Terrace v2:** Distinct box art per spot (`boxes-intact`/`cleared`, `box-double`, `box-single` with a dusty searched tint) and all 3 weed sprites across 6 patches with varied scales/flips
- [x] **M2 · Terrace v2:** `stairwell-door` hotspot (hover outline + "coming soon" label, walk-over + toast via `pushNotice`) *(superseded: the door now rides the lift down to the lobby; its outline and "coming soon" toast are gone)*
- [x] **M2 · Terrace v2:** 3 in-scene buildables (Upgrade Shelter → timber shelter with lantern glow, Herb Planter, Rain Barrel) with bottom-center `BuildBar`, floor blueprint markers, pop-in tween, colliders + Y-sort, and `builtProps` persistence *(superseded by the multi-tier stations below; old `builtProps` migrate to Tier 2)*
- [x] **M2 · Terrace lift arrival:** 3-beat elevator cutscene (`TerraceLiftCutscene.tsx`, ~5.2s, now ~4.5s as the generalized `1 → R` ride) — lobby Ken Burns push-in + footsteps (0–1.7s) → cover-fitted 1376×768 lift stage with sliding door panels in the doorway cutout, amber 1→2→3→4→R indicator, hum + micro-tremor (1.7–3.7s) → ding, doors slide apart onto the sunlit Terrace, ambience swell, caption and step-through into the shelter (3.7–5.2s). Skip/keys stop all beats and the hum; Reduce Motion swaps motion for fades. New foley: `startLiftHum` / `stopLiftHum`, `playLiftDoorSlide`, `playLiftFloorTick`, `playLiftDing`
- [x] **M2 · Stage-space anchoring:** Scene coords are mapped through the backdrop's stage rect (`stageRect`, `toPx` / `toNorm`), so props, colliders, walk bounds, hotspots and floor clicks stay locked to the painted floor on 16:9, ultrawide and portrait windows — and (QA pass) the scene's safe area is never cropped off-screen
- [x] **M2 · 3-Phase Day Cycle & Vitality HUD:** 12-minute real-time day (`day` Full Sun → `dusk` Sunset → `night` Half Moon, 240s/phase, paused outside shelter or in settings), `stamina` & `strength` vitality stats persisted in `SaveState` with legacy `timeOfDay` migration, 1.4s smooth cubic sky lighting tweens, night twinkling stars + drifting warm fireflies + dusk/night fire/lantern glow pools, context-aware `sleep-shed` (**"Rest by shelter"** in day/dusk vs **"Sleep until morning"** at night → `Day N+1 · Morning`), and bottom-left circular Time-Dial + glass Test-Tube HUD (`VitalityDialHud.tsx`)
- [x] **M2 · Calm rooftop entry:** traveler appears at the stairwell threshold (`entryPoint` 0.84, 0.69), pauses ~280ms after the reveal, then strolls ~2s to `idlePoint` (0.72, 0.71) with soft footsteps and a slower walk bob
- [x] **M2 · 4-frame walk cycle & downstairs poses:**
  - **Sprites (`media.ts`):** `TravelerPose` adds `reach`, `peek` and `fix` (`TRAVELER_POSES`). `travelerWalkFrames(gender)` returns the 4 `walk-{1..4}` paths, and `ALL_TRAVELER_SPRITES` lists every pose plus the frames.
  - **Loading:** `ShelterScene.preloadTravelerPoses()` loads all 8 poses and the 4 frames, ignoring a late load after a traveler swap. A walk starts on frame 1.
  - **Animation:** while walking, `stepWalkCycle()` steps `0 → 1 → 2 → 3 → 0` every 160ms (240ms on the stairwell entry stroll). It plays a footstep on each foot-contact frame (1 and 3); the bob dips at each contact and peaks mid-stride. The click itself is the first step, and the entry stroll's old fixed-time footsteps were removed in favour of frame-synced ones.
  - **Fallbacks:** with Reduce Motion, or before the frames load, the single `walk` still is used with the steady 380ms footsteps and no bob.
  - **Downstairs poses:** heights `reach` 1.0, `fix` 1.0, `peek` 0.60, with matching ground shadows. They're registered and preloaded but not used yet; they're intended for the scavenging rooms.
- [x] **M2 · Randomized per-run layout:** seeded `generateTerraceSpawns()` places the 3 boxes and 6 weeds (shuffled sprites, 0.92–1.08× scale, random flips) clear of walls, structures, the entry path and each other; persisted as `spawns` in `ows_terrace_state`, regenerated on Start Fresh / Reset
- [x] **M2 · 3-tier fire pit:** `firepitTier` (1 twigs → 2 stacked logs → 3 stone-ring hearth) via `firepit-t2` / `firepit-t3` buildables (`requires` chain in `BuildBar`), `playLogStack` / `playStoneSet` foley, and per-tier `FIRE_TIERS` visuals (multi-tongue flames, coal bed, ember rate, smoke wisps, 1× / 1.35× / 1.75× glow) plus `setCampfireAudio(active, level)` crackle intensity. Box timber yields raised (Broken Boxes 3, Weathered Crates 4) so the rooftop covers every build plus Tier 2 *(now the `firepit` station; Tier 3 costs `2🪵 1🔩 2🪨`)*
- [x] **Polish · Brand:** `favicon.png` + `apple-touch-icon.png` in `index.html`; `UI_ASSETS` (`logoTitle`, `logoEmblem`) — painted wordmark on the Title Screen (sr-only `<h1>` kept), emblem as About crest, shelter header badge, and a delayed pulsing loading emblem while the stage decodes (`ShelterScene.setReadyCallback`)
- [x] **Polish · About:** player-facing story intro, 3 How-to-play tips, `One Warm Spot · v0.1` footer
- [x] **Polish · Reduce Motion:** helper line in Settings; in-scene floating reward text fades in place; pouch bounce, medallion/bar transitions and loader pulse disabled in CSS (fire flicker, sparks/smoke, fireflies, stars and leaf bursts were already calmed)
- [x] **Polish · Full-state backups:** `backup.ts` bundles `terraceState` into `.json` backups with strict validation + older-backup compatibility; **Load Backup** on the Title Screen; scene reloads via `sceneRevision` after a restore
- [x] **Polish · Terrace-only focus:** `pipe` & `tree` marked `comingSoon` ("Coming soon") — the Terrace is the single unlocked shelter
- [x] **Polish · Vitality Medallion HUD:** antique-bronze bezel with phase sky windows (full sun / sunset / half moon, crossfading), progress ring inside the bezel, Day plaque above (fixes the "Day 1" overlap), smoked-glass sage-emerald / hearth-amber bars
- [x] **Polish · Medallion alignment:**
  - 80px medallion in an 80px wrapper on a single centred flex row.
  - "Day N" plaque absolutely centred over it (`top: -10px; left: 50%; translateX(-50%)`).
  - 62px smoked-glass capsule tucked behind the circle's right half (`margin-left: -28px`, 38px left padding, `0 999px 999px 0` radius), so its edges meet the bezel's curve with no square corner showing.
- [x] **M2 · Composed Terrace layout:** stations re-anchored into a Living & Mending nook (shelter 0.30/0.56, sewing 0.46/0.54, farm 0.17/0.68), the Central Hearth (0.49/0.72) and a Cooking & Utility line (grill 0.62/0.56, barrel 0.76/0.57); `keepClear` and the default layout updated; box/weed spawns biased to the rooftop perimeter (`perimeterBand`); older saved layouts repaired on load
- [x] **M2 · Overnight regrowth:** `regrowTerraceSpawns` (1–2 cleared weeds per night, one searched box every 2nd day, new valid spots — *since replaced by the weather-specific rules above*) wired through `sleepAtShelter()` → `regrowStoredTerrace()` → `ShelterScene.applyOvernightRegrowth()`, with a morning-toast note
- [x] **M2 · Core Vitality & Multi-Tier Progression:** 🍅 `food` as the 7th resource (save/backup migration → 0, 7-item pouch); 14 new station sprites in `SCENE_PROPS`; `TERRACE_STATIONS` (Shelter 1–3, Fire Pit 1–3, Farm 0–3, Rainwater Barrel 0–3, Cooking Grill 0–4, Sewing Kit 0–5) replacing the one-off buildables, with legacy `builtProps` → Tier 2 migration; shelter-tier sleep comfort + morning farm/barrel refresh; farm harvest & rainwater collection; `StationPopover` for grill Cooking (5 recipes) and sewing Mending (3 perks: sheets, gloves, cloak); `playHarvest` / `playCook` / `playSew`; grill steam; T3 hut window + lantern glows; ⚠️ `TEST_MODE_GENEROUS_START` pool
- [x] **Polish · Pre-Game & In-World Contextual Menu Pass:** removed boxy dark halo scrim behind `TitleScreen` wordmark (keeping clean `drop-shadow`); centered `SiteSelector` flex-wrap card rows and equalized `.ows-pill` top-bar toggle heights (`38px`); replaced bottom `BuildBar` with contextual in-world `PropActionMenu` above clicked stations and *"Craft {name} ({cost})"* blueprint hints; natural tier names in lock hints (`stationRequirementHint`, 🔒 rows); prop hover tint + 3% lift replacing the old hover rings; added instant `.ows-pouch-tooltip` parchment hover/focus tooltips to all 7 pouch materials
- [x] **M2 · Ride down to the lobby:** rooftop `stairwell-door` → `TerraceLobbyScreen` (reverse lift ride R→1, skippable, Reduce Motion fades) ending in an interactive ground-floor lobby — glowing *"Coming soon"* apartment doors and the lift / ↑ Rooftop back up via the arrival ride; shared `liftStage.tsx` and global lift keyframes; scene `DoorCallback` *(superseded by the elevator & four floors below; `TerraceLobbyScreen` became `BuildingFloorScreen`)*
- [x] **M2 · The old elevator & four apartment floors:**
  - Assets and data: `terrace-floor-2/3/4.webp` in `CUTSCENE_ASSETS`, and a data-driven `data/floors.ts` (floors 1–4 + R, % hotspots, panel stops, tick sequence, ride timeline).
  - `ElevatorPanelModal` brass floor picker, opened from the rooftop door and from every floor's lift.
  - `TerraceLiftCutscene` generalized to `fromFloor → toFloor` rides scaled by distance (2.8–4.5s) that open on the destination painting and caption. The arrival is the `1 → R` ride, and `LiftRideScreen` is the in-building shell.
  - `BuildingFloorScreen` replaces `TerraceLobbyScreen`: every floor has glowing scavenging spots ("puzzle coming soon") and Floor 3's fuse box crackles with electric arcs; the lift is the single way to change floors (its panel includes R).
  - The rooftop day clock is paused off the roof.
- [x] **M2 · Flexible Predefined Build Slots:** the 4 hardcoded farm/barrel/grill/sewing spots became generic `slot-1…4` (`TERRACE_BUILD_SLOTS`). An empty slot reads *"Build here"* and opens `SlotBuildMenu` with every unplaced station (Tier 1 name, icon, cost); the pick walks over, pays, assigns the slot and pops the station in. `slotAssignments` is persisted in `ows_terrace_state` and backups: strict validation, no duplicates, and legacy saves keep their old layout via `reconcileSlotAssignments`. Pure rules live in `engine/buildSlots.ts`; spawns keep every slot clear for its widest possible station.
- [x] **M2 · QA pass (Playwright E2E + fixes):** 28-scenario E2E suite in system Chrome (`npm run test:e2e`) covering menus, the full rooftop loop, every floor, saves/backups/refresh, landscape phones & tablets and touch. Fixes from it and a code audit:
  - **Narrow / 4:3 windows:** cover-fit cropped the stairwell door (the only way downstairs), the shelter, slot-1/slot-4 and floor hotspots off-screen. Stages now use `fitStage()` with a per-scene safe area plus a blurred backdrop fill; 16:9 is unchanged.
  - **Landscape phones & tablets:** the pouch wrapped below ~950px (a fixed box at `left: 50%` is capped at half the viewport — now `width: max-content`, compact under 1150px wide / 520px tall); the shelter name hides under 1150px (emblem stays; 1360px since the weather chip joined the header) instead of sitting under the pouch; prop menus and the cook/mend popover stay on screen below the pouch (`useKeepInView`, scrolling if taller than the room); compact elevator panel and a 74% medallion under 520px tall. Taps work like clicks.
  - **Refresh resumes in place** (rooftop, floors, mid-ride → destination) instead of always returning to the Title.
  - **Fire pit hover label** is just *"Fire pit"* (a click opens its options) instead of *"Extinguish fire"* / *"Light fire pit"*.
  - **Cutscene keys:** Space/Enter/Escape no longer skip a ride while Settings (or any control) has focus.
  - **Reduce Motion mid-ride:** no longer restarts the lift beats (or the arrival hold).
  - **Menu music:** returning to the title within 0.75s of leaving it no longer leaves the title silent (`fadeInMenuMusic` restarts a fading session).
  - **Pouch pulse:** a second find within 700ms no longer leaves the earlier material's pulse stuck on.
  - **Lint:** 0 oxlint warnings (`BackgroundStage` / `ShelterScreen` derive state during render; `LIFT_FADE_MS` / `liftRideHoldMs` moved to `data/floors.ts`).
- [ ] **M2:** Custom interactive scene configs & prop sprites for remaining shelters (`pipe`, `tree`, etc.)
- [ ] **M2:** Tier 1–3 painted visual layer swaps & macro-build restoration integrated into interactive scenes
- [x] **M2 · Live Rooftop Weather (Rain & Wind):** weather simplified to clear / rain / wind (legacy `'breezy'` / `'storm'` → wind in saves & backups; the dormant dust-squall scavenging block retired). Rain: +1 💧 from the barrel, 2–3 weeds regrow overnight, pooled slanted streaks + floor ripples + a cool overcast blended into every day phase, soft rain-patter audio. Wind: 1–2 cardboard cartons blow in overnight (refined later: cartons only, no weeds), +1 bonus material per box searched, golden dust motes + tumbling leaves in gusts with swaying weeds, airy gust audio. Weather chip with effect tooltip in the shelter header; weather sound fades out downstairs. Reduce Motion keeps only the calm wash / a few still motes. *(Next: Cold weather — see `GAME_CONTEXT.md` → Future.)*
- [x] **M2 · Wooden crates vs. cardboard cartons & sharper weather regrowth:** 2 permanent wooden crates (opened → stay as scenery with an *"needs an axe — coming soon"* hint) and 1–2 light cartons (`prop-cardboard-1/2/3`; searched → fade away, spawn removed, floor freed). Overnight: clear = 1 weed, rain = 2–3 weeds, wind = 1–2 cartons (max 3, never crates); no other box respawns. Legacy `boxes-1..3` saves/backups migrate by art.
- [ ] **M2 · Crafted Axe:** chop opened wooden crates for extra 🪵 Timber (frees their spot) — see `GAME_CONTEXT.md` → Design Roadmap.
- [ ] **M2 Art & Immersion Upgrades:** Lit fire-pit sprites, an opened variant for `box-double`, arrival vignettes for the other 8 shelters, and dedicated Morning/Afternoon/Evening/Night painted backdrops
- [ ] **M2 Design:** Wood-burning fire over time (lighting already costs 1 Timber), beyond-the-roof gathering behind the four floors' scavenging spots (then switch off `TEST_MODE_GENEROUS_START` and tune scarcity), more Terrace anchor upgrades (parapet repair, string lights), traveler clothing progression (cozy cloak → Tier 2 outfit sprite) (see `GAME_CONTEXT.md` → Design Roadmap)

### 🧭 Planned / Next Milestones

- [ ] **Downstairs Apartment Interiors & Scavenging Mini-Game Framework** *(design: `GAME_CONTEXT.md` → Downstairs Scavenging & Cozy Mini-Game Puzzles)*
  - **Rooms:** ✅ *Interiors built* — opened room doors lead into generated rooms (`data/rooms.ts` + `ApartmentRoomScreen.tsx`, see "Apartment Room Interiors" above). **Next pass:** turn the placed props' inspect toast into searchable spots wired to the mini-games (e.g. Find the Object on wardrobes / cupboards / trunks, Connect the Wires on the TV, a lock puzzle on the safe), with per-room searched state stored next to `roomLayouts`.
  - **Reusable mini-game overlay:** one framework triggered from room scavenging hotspots (`safe`, `drawer`, `cupboard`, `under-bed`, `shelf`, …). Rewards feed back cleanly into the main Zustand resource store (`addResources()` + `_save()`); occasional Found Traveler Diary Pages are a later hook.
  - **Shared contract (built):** `src/game/minigames/types.ts` — `MiniGameProps { mode, title?, onComplete(result), onCancel }` and `MiniGameResult { outcome: 'win' | 'draw' | 'loss' | 'cancelled', mode }`. A mini-game never touches resources; the host hotspot maps the outcome to rewards.
  - **Starter puzzle modules — seven built:** **Connect the Wires**, **Tic-Tac-Toe** and **Dots & Lines** (✅ **live across Floors 1–4**), plus **Find the Object**, **Jigsaw Puzzle**, **Safe Dial** and **Hit the Nail** (✅ built, not wired yet). Next milestone: wire the unmounted ones into the remaining scavenging spots and room props the same way (`FloorPuzzle` data on the hotspot, a `game` case in the host screen, `repairedSpots` for once-per-run rewards), replacing the "coming soon" toasts.
  - [x] **Connect the Wires (built, LIVE):** pure engine `src/game/minigames/connectWires.ts` + UI `src/ui/minigames/ConnectWiresGame.tsx`, mounted by `BuildingFloorScreen` for `f3-fusebox` (+3 🔩 scrap, sparks off, *Repaired Fuse Box*; shorts out on Rain).
  - [x] **Tic-Tac-Toe (built, LIVE):** pure engine `src/game/minigames/ticTacToe.ts` + UI `src/ui/minigames/TicTacToeGame.tsx`, wired across Floor 1 (`f1-apt-1a`, `f1-apt-1b`), Floor 3 (`f3-room-3a`, `f3-room-3b`, `f3-locker`), and pre-configured on Axe-gated `f2-boarded` / `f4-boarded` / `f4-boarded-studio`, with `allowRetryOnLoss={false}`.
  - [x] **Dots & Lines (built, LIVE):** pure engine `src/game/minigames/dotsAndBoxes.ts` + UI `src/ui/minigames/DotsAndBoxesGame.tsx`, wired across Floor 1 (`f1-side-door`), Floor 2 (`f2-cupboard`, `f2-room-2a`, `f2-door-2b`), Floor 3 (`f3-broken-door`, `f3-door-3c`), and Floor 4 (`f4-broken-door`, `f4-room-4a`, `f4-trunk`), with Draw replay and Loss daily lock.
  - [x] **Jigsaw Puzzle (built, unmounted):** pure engine `src/game/minigames/jigsaw.ts` + UI `src/ui/minigames/JigsawGame.tsx` + `JIGSAW_IMAGES` (15 paintings in `public/source/jigsaw/` + 4 shelter scenes). Reserved for `f4-bookshelf` (Floor 4). Its only finished outcome is `'win'`.
  - [x] **Find the Object (built, unmounted):** pure engine `src/game/minigames/findTheObject.ts` + art `src/ui/minigames/rummageIcons.tsx` + UI `src/ui/minigames/FindTheObjectGame.tsx`. A natural fit for drawer / cupboard / trunk spots (e.g. Floor 2's Hallway Cupboard, Floor 4's Steamer Trunk). Its only finished outcome is `'win'`.
    - [x] **Safe Dial (built, unmounted):** pure engine `src/game/minigames/safeDial.ts` + UI `src/ui/minigames/SafeDialGame.tsx` (+ `playDialTick` / `playSafeOpen`). A natural fit for the study's `prop-study-safe`. Outcomes `'win'` / `'loss'` (Challenge only).
    - [x] **Hit the Nail (built, unmounted):** pure engine `src/game/minigames/hitTheNail.ts` + UI `src/ui/minigames/HitTheNailGame.tsx` (+ `playNailClang` / `playNailTink` / `playNailFinish`). Fits repair spots (a loose board, a rattling shutter, a wobbly table). Outcomes `'win'` / `'loss'` (Challenge only).
  - **Cozy guarantee:** no punishing timers or harsh failure states; puzzles can always be retried or left.
  - **Follow-ups:** persist per-room searched spots (ties into the Save schema v5 item below), then switch off `TEST_MODE_GENEROUS_START` and tune scarcity.

### 🩺 Audit Pass (with Safe Dial & Hit the Nail)

- [x] **Closing a finished mini-game reported "cancelled":** × / Escape after a win or loss used to call `onCancel`, throwing away a win's reward or dodging a floor's once-a-day loss lock. All seven cards now share `miniGameClose` / `useMiniGameEscape` (see Scavenging Mini-Games).
- [x] **Escape in Settings leaked through:** with the Settings popover open over a game, room or lift panel, Escape closed both. The popover now listens in the capture phase and stops the event.
- [x] **Mute / Settings hidden under cards:** `AudioToggle` moved from z 60 to 75. Stacking order: floor / room screens 10 · room header 30 · lift panel 60 · mini-game overlay 70 · Audio/Settings 75 · jigsaw drag ghost 80 · toasts 90 · About 100 · confirm modals 110.
- [x] **Stale screens after loading a backup mid-session:** `resolveScreen()` (`resumeLocation.ts`) now guards the active screen: no claimed shelter → Title; lift / floor / room on a non-Terrace run → shelter; a room becomes invalid when `sceneRevision` changes (you step out to its floor), and the floor screen remounts on a new revision.
- [x] **Main bundle > 500 KB:** PixiJS code-split (see Backlog).
- [x] **Tic-Tac-Toe on landscape phones:** at ≤ 520px height the card switches to a board-left / status-right grid and all mini-game cards use tighter padding, so 667×375 fits with no card scroll.

### 🌐 GitHub Pages Deploy

- [x] **Sub-path-safe build:** `base: './'`, relative icons in `index.html`, every public asset through `assetUrl()` (no root-absolute `/source/…` left in `src/`); checked under `/One-Warm-Spot/` with `vite preview --base`.
- [x] **Auto-deploy:** `.github/workflows/deploy-pages.yml` (push to `main` / manual) — see Deployment.

### 📐 Responsive Pass (every landscape window)

- [x] **Dynamic viewport:** `100dvh` / `100dvw` everywhere, `visualViewport` + orientation listeners, `viewport-fit=cover` + safe-area insets for notched phones (see Responsive Layout).
- [x] **Proportional HUD:** `--ui-scale` (0.68 → 1.22) on the header, pouch, Settings / Mute, medallion; readable `--ui-text-scale` for menus, toasts, tooltips and Pixi labels; corners pull in on ultrawides. On 667×375 the ← Title cluster and the pouch now have an 84px gap (was 6px); on 1440p the HUD is 1.22× instead of desktop-sized dots.
- [x] **Menus follow their prop through live resizes:** scene menus are anchored at stage points; the stage is reported on every refit.
- [x] **Pixi on any screen:** renderer resolution = min(DPR, 2), re-applied when the window moves to a screen with another pixel density (sprites keep their size, hit-testing stays exact).
- [x] **Lift rides use `fitStage`** (they cover-cropped with CSS before), with the same framing as the floor they leave.
- [x] **Title on landscape phones:** wordmark beside the buttons (it scrolled ~100px before); it and the Shelter Selector grow on big monitors.
- [x] **About on landscape phones:** story and tips side by side, Close always visible (it scrolled ~220px before).
- [x] **Jigsaw drag ghost** moved outside the scaled card, and its 3° tilt now rotates the art itself — the tilt used to swing the ghost's translate away from the pointer (≈ 55px off on 1440p).

### 🔧 Known Technical Backlog

- [ ] **Save schema v5:** Fold `ows_terrace_state` (fire, boxes, weeds, the 6 station tiers, ready flags, `craftedPerks`, `slotAssignments`, `spawns`) into the versioned `SaveState` with a v4 → v5 migration (backups already bundle and validate it via `backup.ts`; this would unify localStorage too and let per-site prop state scale to other shelters).
- [x] ~~**Sleep → day progression:** Connect the lean-to / timber-shelter sleep hotspot to `sleepToNextDay` / day progression and milestone unlocks once the new day rhythm is finalized.~~ → Implemented via `sleepAtShelter()` (`day + 1`, `"Day N · Morning"` toast, day-survival milestone checks) and `restAtShelter()`.
- [ ] **Stations → Cozy Index:** Decide how the in-scene stations relate to the 10 macro upgrades (Cozy Index, `totalUpgradesBuilt` milestones) — today they are visual + vitality/material loops only.
- [ ] **Station art tuning:** `propScale`, colliders, stand offsets and glow anchors for the 14 tier sprites are first estimates — verify in the browser, especially the larger T3/T4/T5 sprites against the back parapet, now that any station can stand in any slot.
- [ ] **Fine-tune exact Terrace station and slot coordinates for maximum cozy visual composition.** (`SHED_POS`, `FIREPIT_POS`, `TERRACE_BUILD_SLOTS` positions & stand offsets in `data/scenes/terrace.ts`; re-run the spawn tests afterwards since `keepClear` follows the slots.)
- [ ] **Floor hotspot tuning:** the `BUILDING_FLOORS` rects in `data/floors.ts` (lobby and Floors 2–4) were measured by eye from the paintings — nudge any whose glow doesn't sit on its door, cupboard, locker or trunk. Same for the fuse-box arc and ember positions (`ARCS` / `EMBERS` in `BuildingFloorScreen.tsx`).
- [ ] **Room zone tuning:** the anchor zones (`zonesFor` floor lines / wall edges, `maxHeight` under windows) and prop `baseScale`s in `data/rooms.ts` were measured by eye from the four shells — adjust if a piece looks too big, too small or too close to a window once more layouts have been seen.
- [x] ~~**Persist the current floor (optional):** a refresh while downstairs returns to the Title → rooftop.~~ → A refresh now resumes the same place (rooftop, any floor, the shelter selector) via `engine/resumeLocation.ts` (per tab, `sessionStorage`).
- [ ] **Station-menu UX review:** maxed single-action stations skip the menu while upgradeable ones open it — revisit if that feels surprising in play. *(Empty build slots now always open a menu, so building is never an accidental one-click spend.)*
- [ ] **`stationRequirementHint` is Terrace-only** (looks up `TERRACE_STATIONS`); make it site-aware when Shelter #2 gets stations.
- [ ] **Generous test pool:** `TEST_MODE_GENEROUS_START` (`data/modes.ts`) must be switched off once downstairs scavenging provides Stone/extra materials.
- [ ] **Scene registry:** Replicate the data-driven `ShelterSceneConfig` pattern from `src/game/data/scenes/terrace.ts` to the remaining 8 shelters and register them in `getSceneConfig()` (`src/game/data/scenes/index.ts`).
- [ ] **Split `shelterScene.ts`** (~2,500 lines after the day cycle, fire tiers, stations, regrowth and station menus) into focused modules (actor/traveler, hotspots, stations, fire/particles, lighting) **before** adding Shelter #2.
- [x] ~~**Stage-space coordinates:** Hotspot/obstacle coords were normalized to the viewport while the backdrop is cover-scaled, so props drifted off the painted floor on aspect ratios far from 16:9.~~ → Fixed: everything maps through the backdrop's stage rect (`stageRect`), which since the QA pass also keeps each scene's safe area on screen (`fitStage`).
- [ ] **Local Vitest out of date:** `package.json` and the lockfile pin `vitest ^5.1.2`, but this machine's `node_modules` still has 3.2.7 (`npm ls` reports it invalid). Run `npm ci` locally to match CI (the Pages build doesn't run tests).
- [ ] **E2E in CI:** the suite runs locally against system Chrome; a CI job would need `npx playwright install chromium` (works off the corporate proxy) or a Chrome runner, plus `npm run test:e2e`.
- [ ] **Menu music asset:** `/source/audio/music-menu.mp3` is optional and not shipped; the procedural warm-pad chord loop is the active menu music until a track is added.

### 🧭 Intentional Design Decisions (QA review — don't "fix")

- **Platforms:** desktop browsers first; tablets and phones in **landscape** only. Portrait is not a supported layout (no rotate prompt, no portrait tuning). Everything landscape is proportional (see Responsive Layout).
- **Medallion floor:** the Vitality medallion scales with `--ui-scale` but never below 0.74 (its small Stamina / Strength captions would be unreadable at 0.68).
- **Elevator names:** the panel uses short stop names; floor headers/captions use full names.
- **Rest fast-forward:** resting at the shelter moves day → dusk → night immediately (+25 Stamina) — a cozy "skip ahead", so nobody has to wait out the real-time clock.
- **Sit pause after lighting the fire:** ~0.6s where clicks are ignored so the sit-down is visible.
- **Generous start pool:** `TEST_MODE_GENEROUS_START` stays on during the build phase; switch off and tune scarcity once more gathering exists.
- **Downstairs placeholders:** floor scavenging spots without a wired puzzle (e.g. Floor 4's Bookshelf, reserved for Jigsaw) show "puzzle coming soon"; Jigsaw, Find the Object, Safe Dial and Hit the Nail are built and unmounted (see Planned / Next Milestones).

### 🗺️ Backlog

- [ ] Field Journal / quest log beyond relics (day log, hand-drawn illustrations)
- [ ] Scavenging expedition map (multi-day trips to farther zones)
- [ ] Radio signal / visitor events
- [ ] Optional `.webm` animated shelter backgrounds
- [x] ~~Code-split PixiJS (main chunk > 500 KB)~~ → `ShelterCanvas` is lazy-loaded and cutscenes preload it via `preloadShelterScene()`; the main chunk is ~410 KB and the build has no size warning.
- [ ] Upgrade Vitest 3 → 4 (dev-only audit advisories)
