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
| Runtime | Node.js LTS | 26.x |
| Package Manager | npm | 11.x |

---

## Repository Structure

```
One-Warm-Spot/
├── GAME_CONTEXT.md              # Creative & design bible
├── DEV_STATUS.md                # This file — architecture & tracker
├── index.html                   # Entry HTML (loads Google Fonts)
├── package.json
├── tsconfig.json / .app / .node # TypeScript project references, strict: true
├── vite.config.ts
├── public/
│   ├── source/                  # Background images (WebP)
│   │   ├── bg-title.webp
│   │   ├── bg-valley.webp
│   │   ├── bg-terrace.webp ... bg-island.webp
│   │   └── audio/
│   │       └── music-menu.mp3   # (optional — procedural fallback if absent)
│   └── assets/sites/            # Per-site placeholder art folders
│       ├── terrace/ pipe/ tree/
└── src/
    ├── main.tsx                 # React root mount
    ├── App.tsx                  # Screen router: title → site-select → arrival → shelter
    ├── styles/
    │   └── theme.css            # CSS custom properties, cozy palette, frosted-card util
    ├── game/                    # ── Pure game logic (no React imports) ──
    │   ├── types/game.ts        # SiteId, GameMode, TravelerGender, Site, Resource, SaveState…
    │   ├── data/
    │   │   ├── sites.ts         # 9 shelter sites (5 cozy + 4 challenge)
    │   │   ├── resources.ts     # 6 core materials
    │   │   ├── survivalKit.ts   # 5-item Day 1 kit
    │   │   ├── upgrades.ts      # Tier 1–2 macro upgrades (repair-first framing)
    │   │   └── media.ts         # Background image paths + fallback gradients
    │   ├── engine/
    │   │   └── saveSystem.ts    # localStorage autosave/load + validated JSON export/import
    │   ├── audio/
    │   │   └── soundEngine.ts   # Web Audio singleton: Music & SFX/Ambience channels, 9-site ambience
    │   ├── store/
    │   │   └── useGameStore.ts  # Zustand store (day, site, mode, gender, reduceMotion, actions)
    │   └── renderer/
    │       └── ShelterCanvas.tsx # PixiJS canvas (placeholder layered 2D scene)
    └── ui/
        ├── TitleScreen.tsx           # Upper-sky title block + radial scrim + Continue/New Game/About
        ├── SiteSelector.tsx          # Compact header bar, equal-height 3/2/1 responsive shelter cards
        ├── ArrivalCutscene.tsx       # Lightweight in-engine cutscene (Ken Burns + walking, reduce-motion aware)
        ├── SettingsPopover.tsx       # Top-right popover: Music/SFX sliders, Reduce Motion, Save export/import
        ├── ConfirmOverwriteModal.tsx # Safety modal before overwriting an existing saved shelter
        ├── AboutModal.tsx            # Frosted-glass world intro modal
        ├── TopBar.tsx                # Cozy HUD (Day, site, 6 resources, Reset)
        ├── BackgroundStage.tsx       # Full-viewport crossfade background (image/video/gradient)
        └── AudioToggle.tsx           # Floating Settings gear + Mute/Unmute cluster
```

---

## Architectural Rules

1. **Game simulation is decoupled from rendering and React UI.** Everything under `src/game/data/`, `src/game/engine/`, and `src/game/store/` has zero React imports. Swap placeholder art for illustrated layers without rewriting game logic.
2. **Renderer (`src/game/renderer/`) bridges game → PixiJS.** React components in `src/ui/` handle HUD, menus, and flow.
3. **Sound engine is a plain singleton module** (`soundEngine.ts`) — no React context, no heavy audio library.

---

## Asset Pipeline

| Asset | Location | Format | Fallback |
|-------|----------|--------|----------|
| Shelter backgrounds | `public/source/bg-*.webp` | WebP, 1920×1080 recommended | Cozy CSS gradient per entry in `media.ts` |
| Menu music | `public/source/audio/music-menu.mp3` | MP3 (looping) | Procedural warm-pad chord loop |
| UI sounds | Procedural (Web Audio) | — | Always available, 0 KB |
| Hover ambience | Procedural (Web Audio) | — | Per-site wind/water/rustle textures |

---

## Save System

- **Storage:** `localStorage` key `one-warm-spot-save`
- **Schema:** `SaveState` (version 2) — day, chosenSite, selectedMode, travelerGender, resources, unlockedUpgrades, kitCollected, timestamp.
- **Backward compat:** Missing fields (`selectedMode`, `travelerGender`) default to `'cozy'` / `'female'`.
- **Reset:** clears `localStorage` key; JSON export/import helpers available.

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
- [x] PixiJS placeholder shelter canvas with tarp upgrade toggle
- [x] TopBar HUD (Day, site name, 6 resources, Reset Save)
- [x] localStorage autosave with JSON export/import helpers
- [x] `GAME_CONTEXT.md` and `DEV_STATUS.md` living documentation

### 🚀 Next Active Milestone: M1 · Playable Day 1 Shelter View

- [ ] **M1:** Playable Day 1 shelter loop for the 3 starter sites (`terrace`, `pipe`, `tree`)
- [ ] **M1:** Day 1 Survival Kit presentation & macro-upgrade panel wiring
- [ ] **M2:** 6-resource scavenging system (search zones, random yields)
- [ ] **M2:** Tier 1–3 visual layer swaps in PixiJS (patch → reinforce → fortify)
- [ ] Day/Night lighting tint cycle on the shelter canvas
- [ ] Upgrade unlock progression for locked sites (day count, upgrade count checks)
- [ ] Field Journal / quest log
- [ ] Weather events (rain, wind storms — visual + resource impact)
- [ ] Scavenging expedition map
- [ ] Radio signal / visitor events
- [ ] Optional `.webm` animated shelter backgrounds
- [ ] Vitest simulation tests for game engine logic
