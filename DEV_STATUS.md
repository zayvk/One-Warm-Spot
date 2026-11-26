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
| Testing | Vitest | 3.x |
| Runtime | Node.js | v24.14.1 (verified with `node -v`) |
| Package Manager | npm | 11.11.0 |

---

## Repository Structure

```
One-Warm-Spot/
├── GAME_CONTEXT.md              # Creative & design bible
├── DEV_STATUS.md                # This file — architecture & tracker
├── index.html                   # Entry HTML (Google Fonts, favicon.png + apple-touch-icon.png)
├── package.json
├── tsconfig.json / .app / .node # TypeScript project references, strict: true
├── vite.config.ts
├── public/
│   ├── favicon.png / apple-touch-icon.png  # Browser tab & home-screen icons (favicon.svg is no longer linked)
│   └── source/                  # All active art & audio assets live here
│       ├── ui/                  # Brand art: logo-title.webp (Title wordmark), logo-emblem.webp (lantern crest)
│       ├── backgrounds/         # Background images (bg-title, bg-valley, bg-terrace...bg-island.webp)
│       ├── sprites/             # Character pose sprites ({female,male}-{idle,walk,search,sit,sleep}.webp)
│       ├── scenes/              # Interactive stage backdrops (terrace-stage.webp — v2 with stairwell/lift bulkhead)
│       ├── cutscenes/           # Terrace lift arrival plates (terrace-lobby, terrace-lift-frame w/ transparent doorway, terrace-lift-door)
│       ├── props/               # Interactive prop sprites (firepit-t1/t2 + firepit (T3), boxes-intact/cleared, box-single/double, weeds-1/2/3,
│       │                        #   cloth-shed, shed-upgraded, planter, rain-barrel)
│       └── audio/               # Optional music-menu.mp3 (not shipped — procedural warm-pad loop plays instead)
└── src/
    ├── main.tsx                 # React root mount
    ├── App.tsx                  # Screen router: title → site-select → arrival → shelter (+ global toasts)
    ├── styles/
    │   └── theme.css            # CSS custom properties, cozy palette, frosted-card util, pouch pulse
    ├── game/                    # ── Pure game logic (no React imports) ──
    │   ├── types/game.ts        # SiteId, TimeOfDay, Weather, PlayerStats, Upgrade, ScavengeZone, Relic, SaveState…
    │   ├── data/
    │   │   ├── sites.ts         # 9 shelter sites (5 cozy + 4 challenge) + milestone unlock requirements
    │   │   ├── resources.ts     # 6 core materials (+ storage caps)
    │   │   ├── modes.ts         # Cozy vs. Challenge rules, starting materials, weather table & labels
    │   │   ├── scavengeZones.ts # 4 nearby valley scavenging spots (yields + discovery lines)
    │   │   ├── relics.ts        # 8 Valley Relics (Field Journal keepsakes)
    │   │   ├── survivalKit.ts   # 5-item Day 1 kit (with "how it helps" copy)
    │   │   ├── upgrades.ts      # The 10 macro upgrades (cost, energy, cozy, tier prerequisite) + categories
    │   │   ├── media.ts         # Background, sprite, stage, prop & cutscene (CUTSCENE_ASSETS) paths + fallback gradients
    │   │   └── scenes/
    │   │       ├── types.ts     # ShelterSceneConfig, HotspotConfig, SceneObstacle & BuildableConfig schema (normalized 0–1 coords)
    │   │       ├── terrace.ts   # Old Apartment Terrace v2 config (fixed hotspots, box/weed variant tables, default + spawn rules, 5 buildables incl. fire pit tiers)
    │   │       └── index.ts     # getSceneConfig() registry (terrace only for now)
    │   ├── engine/
    │   │   ├── dayCycle.ts    # Pure 3-phase 12-min day clock (240s/phase), Stamina/Strength rest & sleep math
    │   │   ├── progression.ts   # Pure rules: time-of-day, Cozy Index, upgrade status/build, canAfford/spendResources, site unlocks
    │   │   ├── scavenge.ts      # Pure runScavenge(), trip availability, capped resource adds
    │   │   ├── weather.ts       # Daily weather roll + soft-rain water bonus
    │   │   ├── saveSystem.ts    # v4 save: strict validation, migration, persistent progress
    │   │   ├── backup.ts        # .json backups: SaveState (+ stats) + Terrace `terraceState`; strict validate, export/import
    │   │   ├── terraceState.ts  # `ows_terrace_state` parse/load/save/clear (fire, boxes, weeds, builtProps, firepitTier, spawns)
    │   │   ├── terraceSpawns.ts # Pure seeded box & weed layout generator + `findSpawnProblems` validator
    │   │   └── __tests__/       # Vitest suites (save, scavenging & modes, progression & unlocks, Terrace v2)
    │   ├── audio/
    │   │   └── soundEngine.ts   # Web Audio singleton: Music & SFX/Ambience channels, 9 site soundscapes, shelter + lift foley
    │   ├── store/
    │   │   └── useGameStore.ts  # Zustand store (day/time/energy/weather, upgrades, scavenging, relics, stats, notices)
    │   └── renderer/
    │       ├── ShelterCanvas.tsx # React bridge: Pixi Application + ResizeObserver + reward/build/notice bridges + requestBuild handle
    │       └── shelterScene.ts   # Data-driven point-and-click Pixi scene: stage-space (cover rect) mapping, backdrop, pose crossfades, hotspots, obstacles, in-scene builds, particles
    └── ui/
        ├── TitleScreen.tsx           # Painted logo-title wordmark (+ sr-only h1) + Continue/New Game + About / Load Backup
        ├── backupImport.ts           # Shared `restoreBackupFile()` used by Title Load Backup & Settings import
        ├── SiteSelector.tsx          # Header bar, traveler sprite portraits, 3/2/1 responsive shelter cards
        ├── ArrivalCutscene.tsx       # Cutscene shell (fade-out, Skip button, Space/Enter/Escape); Ken Burns fade for most shelters
        ├── TerraceLiftCutscene.tsx   # 3-beat Terrace lift arrival (lobby push-in → lift ride 1→R → doors open), reduce-motion aware
        ├── ShelterScreen.tsx         # Playable shelter view: full-viewport canvas + ← Title + emblem badge + Pouch HUD + VitalityDialHud + Build Bar
        ├── VitalityDialHud.tsx       # Bottom-left bronze Vitality Medallion (phase sky window + progress ring + Day plaque) + smoked-glass Stamina/Strength bars
        ├── BuildBar.tsx              # Bottom-center frosted chips for unbuilt, unlocked (`requires`) in-scene upgrades (dimmed when unaffordable)
        ├── TopBar.tsx                # 💤 Dormant M1 HUD bar (unmounted — see "Archived / Unmounted M1 Files")
        ├── UpgradePanel.tsx          # 💤 Dormant M1 Upgrade drawer (unmounted)
        ├── ScavengePanel.tsx         # 💤 Dormant M1 Valley Scavenge drawer (unmounted)
        ├── SurvivalKitPanel.tsx      # 💤 Dormant M1 Survival Kit / Field Journal drawer (unmounted)
        ├── ConfirmResetModal.tsx     # 💤 Dormant in-shelter Reset Save confirmation (unmounted)
        ├── NoticeToasts.tsx          # Gentle toasts (Morning of Day N, new shelter unlocked, stairwell door)
        ├── SettingsPopover.tsx       # Top-right popover: Music/SFX sliders, Reduce Motion (+ helper line), Export / Load Backup
        ├── ConfirmOverwriteModal.tsx # Safety modal before overwriting an existing saved shelter
        ├── AboutModal.tsx            # Player-facing About: emblem crest, 2-paragraph story, 3 How-to-play tips, v0.1 footer
        ├── BackgroundStage.tsx       # Full-viewport crossfade background (image/video/gradient)
        └── AudioToggle.tsx           # Floating Settings gear + Mute/Unmute cluster
```

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
| `ShelterScreen.tsx` | Mounts `ShelterCanvas`, a **← Title** button + shelter name, the centered Found Materials Pouch (🪵 🔩 🧵 🌱 — Stone & Water are intentionally hidden until in-scene sources exist), the bottom-left `VitalityDialHud`, and the bottom-center `BuildBar` for the site's unbuilt `buildables`. Drives the 1s real-time phase clock while mounted and unpaused. Chips call `ShelterCanvas`'s imperative `requestBuild(id)`. Starts the site ambience bed. |
| `ShelterCanvas.tsx` | Reads `chosenSite`, `timeOfDay`, `dayPhase`, `unlockedUpgrades`, `lanternLit`, `reduceMotion`, `travelerGender` from the store and forwards them to the scene. Write-backs: **rewards** (`addResources()` + gentle weed/box stamina cost), **build payments** (`spendResources()` + build stamina cost), **rest** (`restAtShelter()`), **sleep** (`sleepAtShelter()`), and **notices** (`pushNotice()` for the stairwell door). Each write calls `_save()`. Mirrors the scene's `{ built, pending }` build state to `ShelterScreen`. |
| `shelterScene.ts` | Looks up configs via `getSceneConfig()` in `data/scenes/index.ts` (`terrace` only; other sites get the generic fallback walk area with no hotspots). **All normalized scene coords (props, hotspots, colliders, obstacles, walk bounds, entry/idle points) are relative to `stageRect`** — the on-screen cover rect of the backdrop, recomputed at the start of every `layout()` — via `toPx()` / `toNorm()`; prop, traveler and glow sizes scale with `stageRect.height`. Tweens lighting over 1.4s across `day` / `dusk` / `night`, fading in twinkling stars, drifting fireflies, and brighter fire/lantern light pools at dusk/night. Context-aware `sleep-shed` rests in `sit` pose during `day`/`dusk` and sleeps until Day `N+1` morning during `night`. On the Terrace, `resolveSceneConfig()` applies the run's saved box & weed `spawns` (`withTerraceSpawns`). Entry: the traveler appears at the stairwell threshold, waits for the 220ms reveal + 280ms, then strolls to `idlePoint` at a fixed ~2s pace (`walkTo(..., durationMs)`). Fire visuals (flame tongues, coal bed, ember rate, smoke wisps, glow size/brightness/tint, crackle level) come from the `FIRE_TIERS` profile for the current `firepitTier`. Persists prop + build state through `engine/terraceState.ts`. |

### Terrace v2 In-Scene Builds

| Buildable | Cost | Placement | Effect |
|-----------|------|-----------|--------|
| `firepit-t2` | 2 🪵 | Upgrades the `firepit` hotspot in place: `prop-firepit-t1.webp` → `prop-firepit-t2.webp` (`tier: 2`) | Pop-in + `playLogStack()`; Tier 2 fire profile |
| `firepit-t3` | 2 🪵 + 1 🔩 | `requires: 'firepit-t2'`; → `prop-firepit.webp` (`tier: 3`) | Pop-in + `playStoneSet()`; Tier 3 hearth profile (coal bed, smoke) |
| `shed-upgrade` | 3 🪵 + 2 🧵 | Upgrades the `sleep-shed` hotspot in place (`upgradesHotspot` + `hotspotOverrides`): cloth lean-to → `prop-shed-upgraded.webp` | Pop-in + lantern glow (`lanternAnchor`) driven by the lighting's `lantern` level (dusk/night/sleep) |
| `herb-planter` | 2 🪵 + 2 🌱 | New prop at (0.24, 0.69) | Pop-in + leaf/sparkle burst |
| `rain-barrel` | 2 🔩 + 1 🪵 | New prop at (0.75, 0.59), beside the bulkhead | Pop-in + water-drop chime |

Flow: chip or blueprint click → `requestBuild()` (refused while busy/asleep-walking/already built/prerequisite missing) → walk to `standOffset` → search pose + `playBuild()` → `onBuild(cost)` pays from the store → `markBuilt()` (tiered fire pit builds raise `firepitTier`; others go into `builtProps`) → `applyBuilt()` (collider + Y-sort) + `playClaim()`. On load, `restoreTerraceState()` re-applies every built upgrade in config order (so Tier 2 before Tier 3) without animation. `emitBuildState()` reports built IDs (including derived fire pit tiers) to the `BuildBar`, which hides chips whose `requires` isn't built yet. These buildables are independent of the 10 macro upgrades (no Cozy Index / milestone effect yet).

### Randomized Box & Weed Layout

`generateTerraceSpawns(seed?)` (`engine/terraceSpawns.ts`, seeded mulberry32) builds a layout for `boxes-1..3` (one of each box sprite, best-of-10 candidates hugging edges/corners) and `weeds-1..6` (two of each weed sprite, ~half biased toward edges), with 0.92–1.08× scale and random `flipX`. Every anchor stays inside `TERRACE_SPAWN_RULES.bounds`, outside the parapet/bulkhead obstacles and the front-left low wall, clear of the `keepClear` circles (fire pit, shelter + rest spot, planter/barrel blueprints + stand spots, stairwell entry path, door stand), and at least `rA + rB + gap` from every other prop (distances in stage-height units, x scaled by the 1376/768 aspect). It retries up to 12 layouts and falls back to `DEFAULT_TERRACE_SPAWNS` if none fits. Box/weed label, reward, size and collider come from the sprite variant (`TERRACE_BOX_VARIANTS` / `TERRACE_WEED_VARIANTS`); stand offsets face the open floor.

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

| Asset | Location | Format | Fallback |
|-------|----------|--------|----------|
| Shelter backgrounds | `public/source/backgrounds/bg-*.webp` | WebP, 1920×1080 recommended | Cozy CSS gradient per entry in `media.ts` |
| Traveler sprites | `public/source/sprites/{female,male}-{idle,walk,search,sit,sleep}.webp` | Transparent WebP | Graceful skip if absent |
| Scene stages & props | `public/source/scenes/*.webp`, `public/source/props/*.webp` | WebP | Stage preloaded into Pixi `Assets` during the arrival cutscene; the scene stays veiled until it's decoded, then fades in (220ms). A failed load shows a neutral `#F5EFE4` base |
| Cutscene plates | `public/source/cutscenes/terrace-*.webp` (1376×768 lobby & lift frame, 508×680 door panel) | WebP (frame has a transparent doorway) | Dark backdrop behind layers |
| Menu music | `public/source/audio/music-menu.mp3` (optional, **not shipped**) | MP3 (looping) | Procedural warm-pad chord loop — **currently the active menu music** |
| UI & shelter foley | Procedural (Web Audio) | — | Always available, 0 KB (includes campfire, rummage, weed snip, sleep, build taps, water-drop chime, lift hum / door slide / floor tick / ding) |
| Site ambience | Procedural (Web Audio) | — | 9 musical soundscapes (birdsong, chimes, drips, creaks, surf…), 350ms crossfade |

---

## Save System

- **Run save:** `localStorage` key `one-warm-spot-save`, `SaveState` **version 4** — day, timeOfDay, energy, weather, chosenSite, selectedMode, travelerGender, resources, unlockedUpgrades (built upgrade IDs), kitCollected, lanternLit, discoveredRelics, stats snapshot, timestamp.
- **Strict validation (`findSaveProblem` / `validateSave` / `parseSaveText`)**: rejects payloads with a friendly, player-facing reason — unreadable JSON, missing/unknown/future `version`, non-integer or out-of-range `day`, unknown shelter / mode / traveler / time of day / weather, negative or fractional materials, damaged upgrade/relic lists, flags or stats. Imports over 512 KB are refused.
- **Migration (`migrateSave`)**: v2 → v3 maps the legacy `'tarp-pitched'` flag onto `shell-1` and fills day-loop defaults; v3 → v4 adds `weather: 'clear'` and `discoveredRelics: []`. Unknown or orphaned upgrades (tier 2 without tier 1) and unknown relics are dropped, materials are capped at storage limits, and each clean-up is reported as a warning (shown after import). Migrated saves are re-written on load.
- **Persistent progress:** `localStorage` key `one-warm-spot-progress` — `PlayerStats` (`maxDaysSurvived`, `totalUpgradesBuilt`, `totalExpansionsBuilt`) + already-announced unlocks. Survives starting a new shelter so unlocked sites stay claimable; pre-v3 players are seeded from their existing save.
- **Terrace prop state (separate key):** `localStorage` key `ows_terrace_state` — `{ fireLit, searchedBoxes, clearedWeeds, builtProps, firepitTier, spawns }`, handled by `engine/terraceState.ts`. `parseTerraceState` tolerates legacy payloads (missing `firepitTier` → Tier 1, missing/damaged `spawns` → `null` = hand-placed default layout), drops unknown/duplicate build IDs, and treats missing/unreadable data as a fresh run with a newly generated layout; `loadTerraceState` writes the normalized state back so that layout survives refresh / Continue. It is **outside** the versioned `SaveState` in localStorage, but `.json` backups now bundle it (see Export/Import). It is cleared by `chooseSite()` and `resetGame()` (fresh runs start with nothing built and a new layout).
- **Reset:** Currently reachable via **New Game / Start Fresh** on the Title screen and Shelter Selector (`ConfirmOverwriteModal`, with backup export). The in-shelter top-bar Reset Save (`ConfirmResetModal`, optional "forget milestones") is dormant with the rest of the M1 UI.
- **Export/Import (`engine/backup.ts`):** A backup file is the `SaveState` (which carries `stats`) plus `terraceState` (`fireLit`, `firepitTier`, `searchedBoxes`, `clearedWeeds`, `builtProps`, `spawns`). `exportBackup()` bundles the stored rooftop; `parseBackupText()` / `importBackup()` run the strict save checks, then `validateTerraceState()` (strict: any damaged rooftop field rejects the file with a friendly message). Older backups without `terraceState` still load — the rooftop starts fresh (with a warning if the run is on the Terrace). Restoring goes through the shared `restoreBackupFile()` (`ui/backupImport.ts`) → store `applyImportedBackup()`: writes/clears `ows_terrace_state`, applies the save, merges stats (max) into persistent progress, and bumps `sceneRevision` so a mounted `ShelterCanvas` rebuilds its scene from the restored rooftop. Available from **Title → Load Backup** (toast + immediate Continue) and **Settings → Export / Load Backup** (inline status). The overwrite/reset modals' "Export Backup" use the same full backup.

---

## Gameplay Rules (M1-A + M1-B — engine rules, UI currently dormant)

| System | Rule |
|--------|------|
| Day loop | `morning → afternoon → dusk → night`; each **Rest** step restores +15 energy. At night **Sleep** advances `day + 1`, resets to morning, refills energy to 100, rolls the day's weather and shows a *Morning of Day N* toast. |
| Energy | 0–100. Each upgrade costs energy (15–40); each scavenging trip costs 25 (Cozy) / 35 (Challenge). "Too Tired" until you rest. |
| Upgrades | 10 total in 4 categories. Tier 2 requires its Tier 1. Statuses: Built / Available / Need Materials / Too Tired / Locked. |
| Cozy Index | Sum of built upgrades' `cozy` values (all 10 = 100). Every 25 points adds +1 material to each scavenging trip. |
| Scavenging | Morning & afternoon only; each trip advances time one phase. 4 spots: Overgrown Highway (scrap, cloth), Fallen Pine Grove (timber, seeds), Crumbling Stone Creek (stone, water), Shattered Greenhouse (seeds, cloth, scrap). Primary materials ≥ 1 and a guaranteed trip minimum (4 Cozy / 3 Challenge). Materials cap at their storage limit. |
| Valley Relics | 25% (Cozy) / 20% (Challenge) chance per trip of an undiscovered keepsake (8 total), re-readable in the Field Journal. |
| Modes | **Cozy:** standard start, ×1 yields, weather clear 50 · breezy 30 · rain 18 · storm 2. **Challenge:** ~60% start (🪵2 🔩2 🧵1 🪨1 🌱1 💧3), ×0.75 yields (floored), weather clear 34 · breezy 26 · rain 20 · storm 20. Zero permadeath, zero raids in both. Claiming a shelter uses that shelter's mode. |
| Weather | Day 1 is always clear. **Soft Rain:** +1–2 💧 each morning (+1 with Rig Rain Collector). **Dust Squall:** closes scavenging for the morning unless Reinforce & Fortify Walls (`shell-2`) is built — afternoon reopens. |
| Lantern | "Light the lantern" appears at dusk/night; once lit it glows every evening. |
| Unlocks | Starter: `terrace` only. `pipe` & `tree` are `comingSoon` (always locked, "Coming soon") while the Terrace is the single focus shelter. Farmhouse 2 upgrades · Country House 7 days · Cave 10 days · Bunker 1 expansion · Beachhouse 14 days · Island 4 upgrades. Days survived = `day − 1`. |

---

## Testing

- `npm test` (`vitest run`) — pure engine suites in `src/game/engine/__tests__/`:
  - `saveSystem.test.ts` — v2 → v4 and v3 → v4 migration, idempotent re-migration, clean-up warnings, 18 malformed-payload rejections with friendly messages.
  - `scavenge.test.ts` — seeded yield bounds per zone, Challenge ≤ Cozy for the same luck, Cozy Index bonus tiers, relic de-duplication, storm/dusk/energy availability, storage caps, mode starting materials, weather odds and rain bonus.
  - `progression.test.ts` — all five upgrade statuses, prerequisite precedence, exact resource/energy deduction, Cozy Index totals, Terrace as the only Day 1 shelter, "coming soon" shelters never unlocking, milestone unlocks for days / upgrades / expansions and one-time announcements.
  - `terraceScene.test.ts` — `spendResources` exact deduction & refusal; `ows_terrace_state` parsing (legacy payloads → Tier 1 + default layout, unknown/duplicate `builtProps`, `firepitTier` values, exact round-trip of tier + spawns, damaged spawns, fresh/unreadable data); balance (rooftop boxes + weeds cover every build plus fire pit Tier 2; a Challenge start + rooftop covers everything incl. Tier 3).
  - `terraceSpawns.test.ts` — 250 seeded layouts all pass `findSpawnProblems` (inside bounds, clear of walls/structures/entry path, no crowding), sprite composition (3 distinct boxes, two of each weed) and scale range, per-seed determinism, and the validator flagging crowded/off-floor props.
  - `backup.test.ts` — full backup round-trip (save, stats, rooftop incl. tier & layout), older backups without `terraceState` (load + "starts fresh" warning), rejection of damaged rooftop fields, and friendly errors for unreadable/invalid saves.

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
- [x] Gentle daily weather (clear / breezy / soft rain / dust squall) with top-bar chip, rain water bonus and storm-closed mornings (fortified walls brave it)
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
- [x] **M2 · Terrace v2:** `stairwell-door` hotspot (hover outline + "coming soon" label, walk-over + toast via `pushNotice`)
- [x] **M2 · Terrace v2:** 3 in-scene buildables (Upgrade Shelter → timber shelter with lantern glow, Herb Planter, Rain Barrel) with bottom-center `BuildBar`, floor blueprint markers, pop-in tween, colliders + Y-sort, and `builtProps` persistence
- [x] **M2 · Terrace lift arrival:** 3-beat elevator cutscene (`TerraceLiftCutscene.tsx`, ~5.2s) — lobby Ken Burns push-in + footsteps (0–1.7s) → cover-fitted 1376×768 lift stage with sliding door panels in the doorway cutout, amber 1→2→3→4→R indicator, hum + micro-tremor (1.7–3.7s) → ding, doors slide apart onto the sunlit Terrace, ambience swell, caption and step-through into the shelter (3.7–5.2s). Skip/keys stop all beats and the hum; Reduce Motion swaps motion for fades. New foley: `startLiftHum` / `stopLiftHum`, `playLiftDoorSlide`, `playLiftFloorTick`, `playLiftDing`
- [x] **M2 · Stage-space anchoring:** Scene coords are mapped through the backdrop's cover rect (`stageRect`, `toPx` / `toNorm`), so props, colliders, walk bounds, hotspots and floor clicks stay locked to the painted floor on 16:9, ultrawide and portrait windows
- [x] **M2 · 3-Phase Day Cycle & Vitality HUD:** 12-minute real-time day (`day` Full Sun → `dusk` Sunset → `night` Half Moon, 240s/phase, paused outside shelter or in settings), `stamina` & `strength` vitality stats persisted in `SaveState` with legacy `timeOfDay` migration, 1.4s smooth cubic sky lighting tweens, night twinkling stars + drifting warm fireflies + dusk/night fire/lantern glow pools, context-aware `sleep-shed` (**"Rest by shelter"** in day/dusk vs **"Sleep until morning"** at night → `Day N+1 · Morning`), and bottom-left circular Time-Dial + glass Test-Tube HUD (`VitalityDialHud.tsx`)
- [x] **M2 · Calm rooftop entry:** traveler appears at the stairwell threshold (`entryPoint` 0.84, 0.69), pauses ~280ms after the reveal, then strolls ~2s to `idlePoint` (0.72, 0.71) with soft footsteps and a slower walk bob
- [x] **M2 · Randomized per-run layout:** seeded `generateTerraceSpawns()` places the 3 boxes and 6 weeds (shuffled sprites, 0.92–1.08× scale, random flips) clear of walls, structures, the entry path and each other; persisted as `spawns` in `ows_terrace_state`, regenerated on Start Fresh / Reset
- [x] **M2 · 3-tier fire pit:** `firepitTier` (1 twigs → 2 stacked logs → 3 stone-ring hearth) via `firepit-t2` / `firepit-t3` buildables (`requires` chain in `BuildBar`), `playLogStack` / `playStoneSet` foley, and per-tier `FIRE_TIERS` visuals (multi-tongue flames, coal bed, ember rate, smoke wisps, 1× / 1.35× / 1.75× glow) plus `setCampfireAudio(active, level)` crackle intensity. Box timber yields raised (Broken Boxes 3, Weathered Crates 4) so the rooftop covers every build plus Tier 2
- [x] **Polish · Brand:** `favicon.png` + `apple-touch-icon.png` in `index.html`; `UI_ASSETS` (`logoTitle`, `logoEmblem`) — painted wordmark on the Title Screen (sr-only `<h1>` kept), emblem as About crest, shelter header badge, and a delayed pulsing loading emblem while the stage decodes (`ShelterScene.setReadyCallback`)
- [x] **Polish · About:** player-facing story intro, 3 How-to-play tips, `One Warm Spot · v0.1` footer
- [x] **Polish · Reduce Motion:** helper line in Settings; in-scene floating reward text fades in place; pouch bounce, medallion/bar transitions and loader pulse disabled in CSS (fire flicker, sparks/smoke, fireflies, stars and leaf bursts were already calmed)
- [x] **Polish · Full-state backups:** `backup.ts` bundles `terraceState` into `.json` backups with strict validation + older-backup compatibility; **Load Backup** on the Title Screen; scene reloads via `sceneRevision` after a restore
- [x] **Polish · Terrace-only focus:** `pipe` & `tree` marked `comingSoon` ("Coming soon") — the Terrace is the single unlocked shelter
- [x] **Polish · Vitality Medallion HUD:** antique-bronze bezel with phase sky windows (full sun / sunset / half moon, crossfading), progress ring inside the bezel, Day plaque above (fixes the "Day 1" overlap), smoked-glass sage-emerald / hearth-amber bars
- [ ] **M2:** Custom interactive scene configs & prop sprites for remaining shelters (`pipe`, `tree`, etc.)
- [ ] **M2:** Tier 1–3 painted visual layer swaps & macro-build restoration integrated into interactive scenes
- [ ] **M2:** Weather visuals & audio on the shelter scene (rain streaks, squall haze, rain-on-roof ambience)
- [ ] **M2 Art & Immersion Upgrades:** Lit fire-pit sprites, "cleared" variants for `box-double`/`box-single`, arrival vignettes for the other 8 shelters, and dedicated Morning/Afternoon/Evening/Night painted backdrops
- [ ] **M2 Design:** Wood-burning fire (lit campfire consumes Timber over time), beyond-the-roof gathering via the lift/stairwell door, more Terrace anchor upgrades (parapet repair, string lights), traveler clothing progression (see `GAME_CONTEXT.md` → Design Roadmap)

### 🔧 Known Technical Backlog

- [ ] **Save schema v5:** Fold `ows_terrace_state` (`fireLit`, `searchedBoxes`, `clearedWeeds`, `builtProps`, `firepitTier`, `spawns`) into the versioned `SaveState` with a v4 → v5 migration (backups already bundle and validate it via `backup.ts`; this would unify localStorage too and let per-site prop state scale to other shelters).
- [x] ~~**Sleep → day progression:** Connect the lean-to / timber-shelter sleep hotspot to `sleepToNextDay` / day progression and milestone unlocks once the new day rhythm is finalized.~~ → Implemented via `sleepAtShelter()` (`day + 1`, `"Day N · Morning"` toast, day-survival milestone checks) and `restAtShelter()`.
- [ ] **Buildables → Cozy Index:** Decide how in-scene buildables relate to the 10 macro upgrades (Cozy Index, `totalUpgradesBuilt` milestones) — today they are purely visual + material sinks.
- [ ] **Scene registry:** Replicate the data-driven `ShelterSceneConfig` pattern from `src/game/data/scenes/terrace.ts` to the remaining 8 shelters and register them in `getSceneConfig()` (`src/game/data/scenes/index.ts`).
- [ ] **Split `shelterScene.ts`** (~2,000 lines after the day cycle & fire tiers) into focused modules (actor/traveler, hotspots, builds, fire/particles, lighting) **before** adding Shelter #2.
- [x] ~~**Stage-space coordinates:** Hotspot/obstacle coords were normalized to the viewport while the backdrop is cover-scaled, so props drifted off the painted floor on aspect ratios far from 16:9.~~ → Fixed: everything maps through the backdrop's cover rect (`stageRect`).
- [ ] **Menu music asset:** `/source/audio/music-menu.mp3` is optional and not shipped; the procedural warm-pad chord loop is the active menu music until a track is added.

### 🗺️ Backlog

- [ ] Field Journal / quest log beyond relics (day log, hand-drawn illustrations)
- [ ] Scavenging expedition map (multi-day trips to farther zones)
- [ ] Radio signal / visitor events
- [ ] Optional `.webm` animated shelter backgrounds
- [ ] Code-split PixiJS (main chunk > 500 KB) and upgrade Vitest 3 → 4 (dev-only audit advisories)
