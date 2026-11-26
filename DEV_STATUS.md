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
    │   │   ├── resources.ts     # 7 core materials incl. 🍅 food (+ storage caps)
    │   │   ├── modes.ts         # Cozy vs. Challenge rules, starting materials, ⚠️ TEST_MODE_GENEROUS_START pool, weather table & labels
    │   │   ├── scavengeZones.ts # 4 nearby valley scavenging spots (yields + discovery lines)
    │   │   ├── relics.ts        # 8 Valley Relics (Field Journal keepsakes)
    │   │   ├── survivalKit.ts   # 5-item Day 1 kit (with "how it helps" copy)
    │   │   ├── upgrades.ts      # The 10 macro upgrades (cost, energy, cozy, tier prerequisite) + categories
    │   │   ├── recipes.ts       # 5 grill RECIPES (tier, ingredients, ⚡/❤️, needsFire) + 3 MENDING_PERKS
    │   │   ├── media.ts         # Background, sprite, stage, prop (all station tier sprites) & cutscene paths + fallback gradients
    │   │   └── scenes/
    │   │       ├── types.ts     # ShelterSceneConfig, HotspotConfig, SceneObstacle, StationConfig / StationTierConfig schema (normalized 0–1 coords)
    │   │       ├── terrace.ts   # Old Apartment Terrace config (hotspots, TERRACE_STATIONS — 6 multi-tier stations, box/weed variant tables, default + spawn rules)
    │   │       └── index.ts     # getSceneConfig() registry (terrace only for now)
    │   ├── engine/
    │   │   ├── dayCycle.ts    # Pure 3-phase 12-min day clock (240s/phase), Stamina/Strength rest & sleep math (SleepComfort, decay params)
    │   │   ├── stations.ts      # Pure station rules: next tier, harvest/collect yields, sleep comfort, gloves/cloak perks, recipeBlocker/applyRecipe, perkBlocker
    │   │   ├── progression.ts   # Pure rules: time-of-day, Cozy Index, upgrade status/build, canAfford/spendResources, site unlocks
    │   │   ├── scavenge.ts      # Pure runScavenge(), trip availability, capped resource adds
    │   │   ├── weather.ts       # Daily weather roll + soft-rain water bonus
    │   │   ├── saveSystem.ts    # v4 save: strict validation, migration, persistent progress
    │   │   ├── backup.ts        # .json backups: SaveState (+ stats) + Terrace `terraceState`; strict validate, export/import
    │   │   ├── terraceState.ts  # `ows_terrace_state` parse/validate/load/save/clear (fire, boxes, weeds, 6 station tiers, ready flags, perks, spawns; legacy builtProps migration)
    │   │   ├── terraceSpawns.ts # Pure seeded box & weed placement: generateTerraceSpawns, regrowTerraceSpawns (overnight), repairTerraceSpawns, perimeterDistance, findSpawnProblems
    │   │   └── __tests__/       # Vitest suites (save, scavenging & modes, progression & unlocks, day cycle, Terrace state/spawns, stations & cooking, backups)
    │   ├── audio/
    │   │   └── soundEngine.ts   # Web Audio singleton: Music & SFX/Ambience channels, 9 site soundscapes, shelter + lift foley (incl. playHarvest / playCook / playSew)
    │   ├── store/
    │   │   └── useGameStore.ts  # Zustand store (day/vitality, resources, cookRecipe, strengthDriftFactor, upgrades, scavenging, relics, stats, notices)
    │   └── renderer/
    │       ├── ShelterCanvas.tsx # React bridge: Pixi Application + ResizeObserver + reward/build/spend/cook/sleep/notice bridges + { performStationAction, cook, craftPerk } handle
    │       └── shelterScene.ts   # Data-driven point-and-click Pixi scene: stage-space (cover rect) mapping, backdrop, pose crossfades, hotspots, obstacles, multi-tier stations, particles
    └── ui/
        ├── TitleScreen.tsx           # Painted logo-title wordmark floating cleanly without backdrop halo (+ sr-only h1) + Continue/New Game + About / Load Backup
        ├── backupImport.ts           # Shared `restoreBackupFile()` used by Title Load Backup & Settings import
        ├── SiteSelector.tsx          # Uniform 38px header toggles, traveler sprite portraits, centered flex-wrap shelter cards
        ├── ArrivalCutscene.tsx       # Cutscene shell (fade-out, Skip button, Space/Enter/Escape); Ken Burns fade for most shelters
        ├── TerraceLiftCutscene.tsx   # 3-beat Terrace lift arrival (lobby push-in → lift ride 1→R → doors open), reduce-motion aware
        ├── ShelterScreen.tsx         # Playable shelter view: full-viewport canvas + ← Title + emblem badge + 7-item Pouch HUD (hover/focus tooltips) + VitalityDialHud + PropActionMenu + StationPopover
        ├── VitalityDialHud.tsx       # Bottom-left bronze Vitality Medallion (80px; phase sky window + progress ring + centred Day plaque) + slim smoked-glass Stamina/Strength capsule tucked behind it
        ├── PropActionMenu.tsx        # Contextual floating pill above clicked stations: Primary Action (Rest/Sleep/Light/Sit/Extinguish/Harvest/Collect/Cook/Mend) + Upgrade tier action
        ├── StationPopover.tsx        # Frosted Cooking (grill recipes) / Mending (sewing perks) popover anchored above the station
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
| `ShelterScreen.tsx` | Mounts `ShelterCanvas`, a **← Title** button + shelter name, the centered Found Materials Pouch (all 7: 🪵 🧵 🌱 💧 🔩 🪨 🍅, pulsing on gains, with instant `.ows-pouch-tooltip` parchment pills on hover/focus), the bottom-left `VitalityDialHud`, and mutually exclusive contextual overlays (`PropActionMenu` for station primary actions / upgrades and `StationPopover` for Cooking/Mending — both rendered inside `<main>`, so scene pixel anchors map straight to CSS). Drives the 1s real-time phase clock while mounted and unpaused. `PropActionMenu` calls `ShelterCanvas`'s imperative `performStationAction(stationId, action)`; `StationPopover` calls `cook(recipeId)` / `craftPerk(perkId)`. Starts the site ambience bed. |
| `ShelterCanvas.tsx` | Reads `chosenSite`, `timeOfDay`, `dayPhase`, `unlockedUpgrades`, `lanternLit`, `reduceMotion`, `travelerGender` from the store and forwards them to the scene. Write-backs: **rewards** (`addResources()`; weeds/boxes cost `gatherStaminaCost()` stamina, farm/barrel yields are free), **build payments** (`spendResources()` + build stamina cost), **spends** (materials only — firewood, mending), **cooking** (`cookRecipe()`), **rest** (`restAtShelter()`), **sleep** (`sleepAtShelter(comfort)`, whose returned overnight `RegrowOutcome` is handed back to the scene), and **notices** (`pushNotice()` with an icon). Checks material affordability live via `setCanAffordCallback()`. Each write calls `_save()`. On every station-state emit it caches crafted perks, sets the store's `strengthDriftFactor` (cloak) and mirrors `{ tiers, pending, fireLit, perks, planterReady, barrelReady }` to `ShelterScreen`; it also forwards station-menu (`onStationMenuOpen`) and station-open (`grill`/`sewing` + anchor) requests. |
| `shelterScene.ts` | Looks up configs via `getSceneConfig()` in `data/scenes/index.ts` (`terrace` only; other sites get the generic fallback walk area with no hotspots). **All normalized scene coords (props, hotspots, colliders, obstacles, walk bounds, entry/idle points) are relative to `stageRect`** — the on-screen cover rect of the backdrop, recomputed at the start of every `layout()` — via `toPx()` / `toNorm()`; prop, traveler and glow sizes scale with `stageRect.height`. Tweens lighting over 1.4s across `day` / `dusk` / `night`, fading in twinkling stars, drifting fireflies, and brighter fire/lantern light pools at dusk/night. Context-aware `sleep-shed` rests in `sit` pose during `day`/`dusk` and sleeps until Day `N+1` morning during `night` (passing `sleepComfort(shelterTier, perks)` and refreshing the farm/barrel ready flags). Clicking stations opens `PropActionMenu` when multiple actions or an upgrade are available (or when Tier 0 blueprint is unaffordable), and executes directly for single-action maxed stations or affordable Tier 0 blueprints. On the Terrace, `resolveSceneConfig()` applies the run's saved box & weed `spawns` (`withTerraceSpawns`). Entry: the traveler appears at the stairwell threshold, waits for the 220ms reveal + 280ms, then strolls to `idlePoint` at a fixed ~2s pace (`walkTo(..., durationMs)`). Fire visuals (flame tongues, coal bed, ember rate, smoke wisps, glow size/brightness/tint, crackle level) come from the `FIRE_TIERS` profile for the current `firepitTier`; lighting the fire spends 1 timber via the spend callback. Persists prop + station state through `engine/terraceState.ts`. |

### Terrace Multi-Tier Stations

`TERRACE_STATIONS` (`data/scenes/terrace.ts`) defines 6 stations, each bound to a hotspot (`hotspotId`) with a `baseTier` (0 = unbuilt), a `buildStandOffset`, and an ordered `tiers[]` of `StationTierConfig` (`name`, `sprite`, `propScale`, `cost`, `collider`, optional `standOffset` / `restOffset`, flourish `effect`, optional dusk/night `glows` anchored in sprite space).

| Station (`hotspotId`) | Tiers → sprite (`SCENE_PROPS` key) | Anchor | Interaction |
|---|---|---|---|
| `shelter` (`sleep-shed`) | 1 `clothShed` · 2 `shedUpgraded` · 3 `shelterT3` | (0.30, 0.56), back-left corner | Rest / sleep; T2 lantern glow, T3 window + doorway glows |
| `firepit` (`firepit`) | 1 `firepitT1` · 2 `firepitT2` · 3 `firepit` | (0.49, 0.72), central hearth | Light (−1 🪵) / extinguish; `FIRE_TIERS` visuals |
| `planter` (`planter`) | 1 `planterT1` · 2 `planter` · 3 `planterT3` | (0.17, 0.68), sunny left parapet | Harvest `planterHarvest(tier)` once per day |
| `barrel` (`rain-barrel`) | 1 `barrelT1` · 2 `rainBarrel` · 3 `barrelT3` | (0.76, 0.57), against the stairwell bulkhead | Collect `barrelCollect(tier)` once per day |
| `grill` (`grill`) | 1 `grillT1` · 2 `grillT2` · 3 `grillT3` · 4 `grillT4` | (0.62, 0.56), back-right parapet | Opens Cooking popover → `cook(recipeId)` |
| `sewing` (`sewing`) | 1 `sewT1` … 5 `sewT5` | (0.46, 0.54), back parapet beside the shelter | Opens Mending popover → `craftPerk(perkId)` |

Anchors are fixed and curated (no grid editor), grouped into three zones that hug the brick walls and keep the centre walkway open: **Living & Mending nook** (shelter, sewing kit, farm), **Central Hearth** (fire pit) and **Cooking & Utility line** (grill + barrel).

Flow: Station or blueprint click → `onHotspotClick()` routes affordable Tier 0 blueprints (`"Empty spot — Craft {name} ({cost})"`) and single-action maxed stations straight into `walkToHotspotAndRun()`, while stations with multiple actions / available upgrades (or unaffordable Tier 0 spots) open the contextual `PropActionMenu` above the prop → choosing an action calls `performStationAction(stationId, action)` → `requestBuild(stationId)` (or primary action). Building walks to `buildStandOffset` → search pose + `playBuild()` → `onBuild(next.cost)` pays from the store → tier field written via `STATION_TIER_KEY` (a fresh T1 farm/barrel starts ready) → `applyStationTier()` swaps the hotspot's config/sprite/collider/stand spot/glows (or shows the floor blueprint at tier 0) with a pop-in + per-`effect` flourish (`playLogStack`, `playStoneSet`, `playWaterChime`, `playSew`, leaf burst). `restoreTerraceState()` applies every saved tier without animation. `emitStationState()` reports tiers/pending/fire/perks/ready flags to React. Hover labels come from `stationLabel()` (e.g. *"Empty spot — Craft Seedling Crate (1 🪵 1 🌱)"*, *"Harvest Herb Planter · +2 🍅 +1 🌱"*, *"Growing — ready tomorrow"*, *"Light fire pit · 1 🪵"*). `cook()` / `craftPerk()` re-check tier, fire and materials, then play `playCook()` + steam or `playSew()` + sparkles with floating feedback. Stations are independent of the 10 macro upgrades (no Cozy Index / milestone effect yet).

Rules live in `engine/stations.ts` (pure, unit-tested): `nextStationTier`, `planterHarvest` (+tier 🍅, +1 🌱 at T2+), `barrelCollect` (+tier 💧), `sleepComfort` (stamina target 75/90/100 by shelter tier, +10 with `warm-sheets`, cap 100; overnight strength loss 10 → 5 at T3), `gatherStaminaCost` (×0.7 with `mended-gloves`), `strengthDriftFactor` / `phaseStrengthDecay` (×0.5 with `cozy-cloak`), `recipeBlocker` / `applyRecipe`, `perkBlocker`. `applySleep()` never lowers stamina you already have.

### Randomized Box & Weed Layout

`generateTerraceSpawns(seed?)` (`engine/terraceSpawns.ts`, seeded mulberry32) builds a layout for `boxes-1..3` (one of each box sprite) and `weeds-1..6` (two of each weed sprite), with 0.92–1.08× scale and random `flipX`. Every prop goes through one shared `placeProp()`. A spot is valid if it stays inside `TERRACE_SPAWN_RULES.bounds`, outside the parapet/bulkhead obstacles and the front-left low wall/steps, clear of the `keepClear` circles, and at least `rA + rB + gap` from every other prop. The `keepClear` circles cover:
- every station zone, sized for its largest tier, plus its stand spot;
- the shelter rest/build spot;
- the stairwell entry path and the door stand.

Distances are in stage-height units, with x scaled by the 1376/768 aspect. **Perimeter bias:** samples must fall within `perimeterBand` (0.1) of the rooftop perimeter, as measured by `perimeterDistance()`. That covers the back/left walls, the front edge, the right edge and the front-left steps. Boxes keep the tightest of 4 in-band samples (corners); weeds take the first in-band sample (natural scatter). A spot off the perimeter is used only if the edges are full. Across 250 seeds, 100% of props land on the perimeter. The generator retries up to 12 layouts and falls back to `DEFAULT_TERRACE_SPAWNS`, which is re-composed around the new zones and itself valid. Box/weed label, reward, size and collider come from the sprite variant (`TERRACE_BOX_VARIANTS` / `TERRACE_WEED_VARIANTS`); stand offsets face the open floor.

`repairTerraceSpawns(spawns)` runs on every load and import (`normalizeTerraceState`). It keeps valid props in place and re-places only those that now overlap scenery or each other, keeping their variant, scale and flip. This covers layouts saved before the stations were recomposed.

### Overnight Regrowth

`regrowTerraceSpawns(state, day, rng?)` is pure and seedable. It starts from `DEFAULT_TERRACE_SPAWNS` when `spawns` is `null`.
- **Weeds:** if any are cleared, 1–2 of them (`WEEDS_REGROWN_PER_NIGHT`, never more than were cleared) are removed from `clearedWeeds` and re-placed via `placeProp()` with a fresh weed variant, scale and flip.
- **Boxes:** on `day % BOX_REFRESH_EVERY_DAYS === 0` (every 2nd day), one searched box is removed from `searchedBoxes` and re-placed with a fresh box variant at a new perimeter spot.
- **Placement:** the moving prop's old spot is freed; every other spawn, including invisible cleared weeds, stays reserved. The whole layout therefore always passes `findSpawnProblems`, and the 3-box / 6-weed caps hold by construction.
- **Return value:** the new state plus `regrownWeeds` / `refreshedBoxes`. When nothing regrew, the same object comes back.

Flow:
1. `ShelterScene.interactSleep()` calls `onSleep(comfort)`, which runs `store.sleepAtShelter()`.
2. On the Terrace, the store runs `regrowStoredTerrace(newDay)` (`engine/terraceState.ts`: read `ows_terrace_state` → regrow → save if changed). It prefixes the morning toast with *"Fresh weeds sprouted overnight."* / *"A weathered crate turned up by the wall overnight."* (or both), then returns the outcome.
3. The scene's `applyOvernightRegrowth()` adopts the new `spawns` / `clearedWeeds` / `searchedBoxes` and re-resolves the scene config. It destroys only the regrown hotspot nodes and recreates them via `createHotspotNode()`, popping them in once their art loads (instant under Reduce Motion).
4. The scene then refreshes the farm/barrel ready flags and saves.

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

- **Run save:** `localStorage` key `one-warm-spot-save`, `SaveState` **version 4** — day, timeOfDay, energy, weather, chosenSite, selectedMode, travelerGender, resources (7 incl. `food`), unlockedUpgrades (built upgrade IDs), kitCollected, lanternLit, discoveredRelics, stats snapshot, timestamp. `food` was added without a version bump: validation lets it be absent (`LATER_RESOURCE_IDS`) and migration fills `food: 0`.
- **Fresh-run materials:** `chooseSite()` uses `freshRunResources(mode)` — the ⚠️ `GENEROUS_TEST_POOL` (`40🪵 15🧵 10🌱 8💧 20🔩 16🪨 6🍅`) while `TEST_MODE_GENEROUS_START` is `true` (`data/modes.ts`), otherwise `startingResources(mode)`. A balance test keeps pool + rooftop ≥ every station tier + every perk + 3 fires + each recipe once.
- **Strict validation (`findSaveProblem` / `validateSave` / `parseSaveText`)**: rejects payloads with a friendly, player-facing reason — unreadable JSON, missing/unknown/future `version`, non-integer or out-of-range `day`, unknown shelter / mode / traveler / time of day / weather, negative or fractional materials, damaged upgrade/relic lists, flags or stats. Imports over 512 KB are refused.
- **Migration (`migrateSave`)**: v2 → v3 maps the legacy `'tarp-pitched'` flag onto `shell-1` and fills day-loop defaults; v3 → v4 adds `weather: 'clear'` and `discoveredRelics: []`. Unknown or orphaned upgrades (tier 2 without tier 1) and unknown relics are dropped, materials are capped at storage limits, and each clean-up is reported as a warning (shown after import). Migrated saves are re-written on load.
- **Persistent progress:** `localStorage` key `one-warm-spot-progress` — `PlayerStats` (`maxDaysSurvived`, `totalUpgradesBuilt`, `totalExpansionsBuilt`) + already-announced unlocks. Survives starting a new shelter so unlocked sites stay claimable; pre-v3 players are seeded from their existing save.
- **Terrace prop state (separate key):** `localStorage` key `ows_terrace_state` — `{ fireLit, searchedBoxes, clearedWeeds, shelterTier, firepitTier, planterTier, barrelTier, grillTier, sewingTier, planterReady, barrelReady, craftedPerks, spawns }`, handled by `engine/terraceState.ts` through one shared `normalizeTerraceState(obj, strict)`. Lenient `parseTerraceState` (localStorage): legacy `builtProps` migrate to Tier 2 (`shed-upgrade` / `timber-shelter` → shelter, `herb-planter` → planter, `rain-barrel` → barrel), out-of-range/non-integer tiers fall back to the base tier, ready flags default to `true` for built farm/barrel, unknown/duplicate perks are dropped, missing/damaged `spawns` → `null` (hand-placed default layout), and missing/unreadable data is a fresh run with a newly generated layout; `loadTerraceState` writes the normalized state back so that layout survives refresh / Continue. It is **outside** the versioned `SaveState` in localStorage, but `.json` backups bundle it (see Export/Import). It is cleared by `chooseSite()` and `resetGame()` (fresh runs start at base tiers and a new layout).
- **Reset:** Currently reachable via **New Game / Start Fresh** on the Title screen and Shelter Selector (`ConfirmOverwriteModal`, with backup export). The in-shelter top-bar Reset Save (`ConfirmResetModal`, optional "forget milestones") is dormant with the rest of the M1 UI.
- **Export/Import (`engine/backup.ts`):** A backup file is the `SaveState` (which carries `stats`) plus `terraceState` (the full rooftop shape above). `exportBackup()` bundles the stored rooftop; `parseBackupText()` / `importBackup()` run the strict save checks, then `validateTerraceState()` (strict: a non-boolean flag, damaged list, out-of-range tier or broken layout rejects the file with a friendly message; legacy `builtProps` / missing station fields still migrate). Older backups load too — missing `food` becomes 0, and backups without `terraceState` start the rooftop fresh (with a warning if the run is on the Terrace). Restoring goes through the shared `restoreBackupFile()` (`ui/backupImport.ts`) → store `applyImportedBackup()`: writes/clears `ows_terrace_state`, applies the save, merges stats (max) into persistent progress, and bumps `sceneRevision` so a mounted `ShelterCanvas` rebuilds its scene from the restored rooftop. Available from **Title → Load Backup** (toast + immediate Continue) and **Settings → Export / Load Backup** (inline status). The overwrite/reset modals' "Export Backup" use the same full backup.

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
  - `saveSystem.test.ts` — v2 → v4 and v3 → v4 migration, idempotent re-migration, pre-Food saves → `food: 0`, clean-up warnings, 19 malformed-payload rejections with friendly messages.
  - `scavenge.test.ts` — seeded yield bounds per zone, Challenge ≤ Cozy for the same luck, Cozy Index bonus tiers, relic de-duplication, storm/dusk/energy availability, storage caps, mode starting materials (Food starts at 0), weather odds and rain bonus.
  - `progression.test.ts` — all five upgrade statuses, prerequisite precedence, exact resource/energy deduction, Cozy Index totals, Terrace as the only Day 1 shelter, "coming soon" shelters never unlocking, milestone unlocks for days / upgrades / expansions and one-time announcements.
  - `dayCycle.test.ts` — phase clock, rest and default sleep math.
  - `terraceScene.test.ts` — `spendResources` exact deduction & refusal; `ows_terrace_state` parsing (legacy payloads → base tiers + default layout, legacy `builtProps` → Tier 2 stations, per-station tier ranges, perk filtering, ready flags only for built stations, exact round-trip of every tier/perk/flag + spawns in lenient and strict mode, damaged spawns, fresh/unreadable data); balance (rooftop alone covers shelter & fire pit T2; the test pool + rooftop covers every tier, perk, 3 fires and each recipe).
  - `stations.test.ts` — every station upgrades one tier at a time to its max (3/3/3/3/4/5), agreed tier costs, farm/barrel yields by tier, sleep comfort 75/90/100 (+10 sheets, cap) and T3 overnight loss 5, `applySleep` never lowering stamina, gloves (−30% gather stamina), cloak (half phase drift), perk & recipe blockers (tier, fire, ingredients), all 5 recipe effects, vitality cap and refusal without ingredients.
  - `terraceSpawns.test.ts` — 250 seeded layouts all pass `findSpawnProblems` (inside bounds, clear of walls/structures/entry path, no crowding) and keep clear of every station anchor and stand spot; ≥ 95% of props on the perimeter band; valid hand-placed defaults; sprite composition (3 distinct boxes, two of each weed) and scale range; per-seed determinism; validator flags crowded/off-floor props. `repairTerraceSpawns` leaves valid layouts alone and moves only overlapping props (keeping their art). `regrowTerraceSpawns`: 1–2 cleared weeds regrow at new valid spots across 250 seeds with nothing else touched, never more than were cleared, a full rooftop is untouched, one searched box refreshes only on even days (mostly on the perimeter), seeded determinism, the `spawns: null` default layout, and 39 cleared-out nights staying valid within the 3-box / 6-weed caps.
  - `backup.test.ts` — full backup round-trip (save incl. food, stats, rooftop incl. station tiers, perks, flags & layout), pre-Food / pre-station backups (food 0, legacy builds → Tier 2), older backups without `terraceState` (load + "starts fresh" warning), rejection of damaged rooftop fields (tiers, flags, lists, layout), and friendly errors for unreadable/invalid saves.

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
- [x] **M2 · Terrace v2:** 3 in-scene buildables (Upgrade Shelter → timber shelter with lantern glow, Herb Planter, Rain Barrel) with bottom-center `BuildBar`, floor blueprint markers, pop-in tween, colliders + Y-sort, and `builtProps` persistence *(superseded by the multi-tier stations below; old `builtProps` migrate to Tier 2)*
- [x] **M2 · Terrace lift arrival:** 3-beat elevator cutscene (`TerraceLiftCutscene.tsx`, ~5.2s) — lobby Ken Burns push-in + footsteps (0–1.7s) → cover-fitted 1376×768 lift stage with sliding door panels in the doorway cutout, amber 1→2→3→4→R indicator, hum + micro-tremor (1.7–3.7s) → ding, doors slide apart onto the sunlit Terrace, ambience swell, caption and step-through into the shelter (3.7–5.2s). Skip/keys stop all beats and the hum; Reduce Motion swaps motion for fades. New foley: `startLiftHum` / `stopLiftHum`, `playLiftDoorSlide`, `playLiftFloorTick`, `playLiftDing`
- [x] **M2 · Stage-space anchoring:** Scene coords are mapped through the backdrop's cover rect (`stageRect`, `toPx` / `toNorm`), so props, colliders, walk bounds, hotspots and floor clicks stay locked to the painted floor on 16:9, ultrawide and portrait windows
- [x] **M2 · 3-Phase Day Cycle & Vitality HUD:** 12-minute real-time day (`day` Full Sun → `dusk` Sunset → `night` Half Moon, 240s/phase, paused outside shelter or in settings), `stamina` & `strength` vitality stats persisted in `SaveState` with legacy `timeOfDay` migration, 1.4s smooth cubic sky lighting tweens, night twinkling stars + drifting warm fireflies + dusk/night fire/lantern glow pools, context-aware `sleep-shed` (**"Rest by shelter"** in day/dusk vs **"Sleep until morning"** at night → `Day N+1 · Morning`), and bottom-left circular Time-Dial + glass Test-Tube HUD (`VitalityDialHud.tsx`)
- [x] **M2 · Calm rooftop entry:** traveler appears at the stairwell threshold (`entryPoint` 0.84, 0.69), pauses ~280ms after the reveal, then strolls ~2s to `idlePoint` (0.72, 0.71) with soft footsteps and a slower walk bob
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
- [x] **M2 · Overnight regrowth:** `regrowTerraceSpawns` (1–2 cleared weeds per night, one searched box every 2nd day, new valid spots) wired through `sleepAtShelter()` → `regrowStoredTerrace()` → `ShelterScene.applyOvernightRegrowth()`, with a morning-toast note
- [x] **M2 · Core Vitality & Multi-Tier Progression:** 🍅 `food` as the 7th resource (save/backup migration → 0, 7-item pouch); 14 new station sprites in `SCENE_PROPS`; `TERRACE_STATIONS` (Shelter 1–3, Fire Pit 1–3, Farm 0–3, Rainwater Barrel 0–3, Cooking Grill 0–4, Sewing Kit 0–5) replacing the one-off buildables, with legacy `builtProps` → Tier 2 migration; shelter-tier sleep comfort + morning farm/barrel refresh; farm harvest & rainwater collection; `StationPopover` for grill Cooking (5 recipes) and sewing Mending (3 perks: sheets, gloves, cloak); `playHarvest` / `playCook` / `playSew`; grill steam; T3 hut window + lantern glows; ⚠️ `TEST_MODE_GENEROUS_START` pool
- [x] **Polish · Pre-Game & In-World Contextual Menu Pass:** removed boxy dark halo scrim behind `TitleScreen` wordmark (keeping clean `drop-shadow`); centered `SiteSelector` flex-wrap card rows and equalized `.ows-pill` top-bar toggle heights (`38px`); replaced bottom `BuildBar` with contextual in-world `PropActionMenu` above clicked stations and cleaner Tier 0 `"Empty spot — Craft ..."` blueprint hints; added instant `.ows-pouch-tooltip` parchment hover/focus tooltips to all 7 pouch materials
- [ ] **M2:** Custom interactive scene configs & prop sprites for remaining shelters (`pipe`, `tree`, etc.)
- [ ] **M2:** Tier 1–3 painted visual layer swaps & macro-build restoration integrated into interactive scenes
- [ ] **M2:** Weather visuals & audio on the shelter scene (rain streaks, squall haze, rain-on-roof ambience)
- [ ] **M2 Art & Immersion Upgrades:** Lit fire-pit sprites, "cleared" variants for `box-double`/`box-single`, arrival vignettes for the other 8 shelters, and dedicated Morning/Afternoon/Evening/Night painted backdrops
- [ ] **M2 Design:** Wood-burning fire over time (lighting already costs 1 Timber), beyond-the-roof gathering via the lift/stairwell door (then switch off `TEST_MODE_GENEROUS_START` and tune scarcity), more Terrace anchor upgrades (parapet repair, string lights), traveler clothing progression (cozy cloak → Tier 2 outfit sprite) (see `GAME_CONTEXT.md` → Design Roadmap)

### 🔧 Known Technical Backlog

- [ ] **Save schema v5:** Fold `ows_terrace_state` (fire, boxes, weeds, the 6 station tiers, ready flags, `craftedPerks`, `spawns`) into the versioned `SaveState` with a v4 → v5 migration (backups already bundle and validate it via `backup.ts`; this would unify localStorage too and let per-site prop state scale to other shelters).
- [x] ~~**Sleep → day progression:** Connect the lean-to / timber-shelter sleep hotspot to `sleepToNextDay` / day progression and milestone unlocks once the new day rhythm is finalized.~~ → Implemented via `sleepAtShelter()` (`day + 1`, `"Day N · Morning"` toast, day-survival milestone checks) and `restAtShelter()`.
- [ ] **Stations → Cozy Index:** Decide how the in-scene stations relate to the 10 macro upgrades (Cozy Index, `totalUpgradesBuilt` milestones) — today they are visual + vitality/material loops only.
- [ ] **Station art tuning:** `propScale`, colliders, stand offsets and glow anchors for the 14 tier sprites (now at their composed anchors) are first estimates — verify in the browser, especially the larger T3/T4/T5 sprites against the back parapet.
- [ ] **Generous test pool:** `TEST_MODE_GENEROUS_START` (`data/modes.ts`) must be switched off once downstairs scavenging provides Stone/extra materials.
- [ ] **Scene registry:** Replicate the data-driven `ShelterSceneConfig` pattern from `src/game/data/scenes/terrace.ts` to the remaining 8 shelters and register them in `getSceneConfig()` (`src/game/data/scenes/index.ts`).
- [ ] **Split `shelterScene.ts`** (~2,400 lines after the day cycle, fire tiers and stations) into focused modules (actor/traveler, hotspots, stations, fire/particles, lighting) **before** adding Shelter #2.
- [x] ~~**Stage-space coordinates:** Hotspot/obstacle coords were normalized to the viewport while the backdrop is cover-scaled, so props drifted off the painted floor on aspect ratios far from 16:9.~~ → Fixed: everything maps through the backdrop's cover rect (`stageRect`).
- [ ] **Menu music asset:** `/source/audio/music-menu.mp3` is optional and not shipped; the procedural warm-pad chord loop is the active menu music until a track is added.

### 🗺️ Backlog

- [ ] Field Journal / quest log beyond relics (day log, hand-drawn illustrations)
- [ ] Scavenging expedition map (multi-day trips to farther zones)
- [ ] Radio signal / visitor events
- [ ] Optional `.webm` animated shelter backgrounds
- [ ] Code-split PixiJS (main chunk > 500 KB) and upgrade Vitest 3 → 4 (dev-only audit advisories)
