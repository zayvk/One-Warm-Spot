# One Warm Spot — Game Context & Design Bible

> **One Warm Spot** is a single-player, cozy, low-difficulty post-apocalyptic survival and shelter-building browser game. It sits closer to *I Am Future* than *Fallout Shelter*—sunlit, restorative, and eye-soothing.

---

## Vision & Elevator Pitch

An asteroid shook the Earth, but the dust has settled. Skies are clearing, sunlight is returning, and somewhere in a quiet valley there is **one warm spot** waiting to become home. You are a lone survivor—not a warrior, just someone who wants a safe place to sleep, a small garden, and a reason to keep going. Find a weathered campsite left by an earlier traveler, patch it up, and build a cozy shelter one upgrade at a time.

---

## World & Lore

- **Setting:** Quiet post-asteroid impact valley; dust has cleared, weather is stabilizing.
- **Tone:** Sunlit recovery, not bleak survival. No monsters, no raiders, no permadeath.
- **Previous travelers:** Every shelter site shows half-broken traces of someone who camped temporarily and moved on—sagging tarps, cold firepits, abandoned crates. The player inherits these traces and repairs them.

---

## Core Design Pillars

1. **Zero permadeath, zero raids, zero time pressure.** The game is intentionally low-stress.
2. **Guided macro-building** instead of granular free-grid furniture or light placement:
   - **Shell tiers** — patch, reinforce, fortify the outer walls/roof.
   - **Preset room dividers** — hang cloth, then build timber frames.
   - **Footprint expansions** — repair a lean-to, then add a full extension.
   - **5–6 curated anchor slots** — workbench, garden bed, rain collector, hearth, etc.
3. **Cozy at every layer:** palette, audio, pacing, and copy.

---

## Shelter Sites (9 total)

### ☀️ Cozy Mode — Relaxed & forgiving

| ID | Name | Status | Tagline | Left Behind |
|----|------|--------|---------|-------------|
| `terrace` | Old Apartment Terrace | ✅ Unlocked | Sunlit rooftop, half-pitched camp | Sagging tarp, crate table, salvaged planks |
| `pipe` | Giant Storm Pipe | ✅ Unlocked | Curved walls, quiet roadside camp | Torn tarp flap, plank windbreak, stone fire ring |
| `tree` | Abandoned Treehouse | ✅ Unlocked | Half-broken canopy refuge | Crooked plank platform, frayed rope ladder, hanging lantern |
| `countryhouse` | Abandoned Country House | 🔒 Survive 7 days | Ivy cottage, propped porch | Propped porch beam, patched window tarp, crate & lantern |
| `farmhouse` | Abandoned Farmhouse | 🔒 2 upgrades | Fallow beds, timber barn | Porch tarp, salvaged fence planks, watering can & lantern |

### ⛰️ Challenge Mode — Exposed & strategic (still zero permadeath)

| ID | Name | Status | Tagline | Left Behind |
|----|------|--------|---------|-------------|
| `cave` | Hillside Cave | 🔒 Survive 10 days | Dry stone alcove, cold firepit | Collapsed lean-to, stone firepit, wooden crates |
| `bunker` | Sunken Service Bunker | 🔒 1 expansion | Wedged steel door, buried shelter | Wedged steel door, stairwell tarp, rusted toolbox |
| `beachhouse` | Abandoned Beachhouse | 🔒 Survive 14 days | Stilt cabin, salt breeze | Torn porch tarp, driftwood fire ring, wooden crate |
| `island` | Abandoned Island Camp | 🔒 4 upgrades | Driftwood jetty, pine shore | Collapsed branch tent, stone fire ring, supply crate |

---

## Player Identity & Onboarding Flow

1. **Title Screen** — Game title, Start / Continue / About buttons, shared menu music.
2. **Shelter Selector** — Traveler picker (Female / Male silhouette), Cozy / Challenge mode tabs, 9 shelter cards with hover background crossfade and procedural ambience.
3. **Arrival Cutscene** (~3.5s) — Ken Burns zoom on the chosen shelter background, animated traveler silhouette walking toward the site, Day 1 caption fade-in, skippable.
4. **Day 1** — Survival kit issued, shelter restoration begins.

---

## 6 Core Resources

| Resource | Emoji | Day 1 Amount |
|----------|-------|-------------|
| Timber | 🪵 | 4 |
| Scrap | 🔩 | 3 |
| Cloth | 🧵 | 2 |
| Stone | 🪨 | 2 |
| Seeds | 🌱 | 1 |
| Water | 💧 | 5 |

---

## Day 1 Survival Kit

Canvas Tarp ⛺, Bedroll 🛏️, Pocket Stove 🔥, Backpack 🎒, Field Journal 📓

---

## Art & Audio Direction

- **Visual style:** Lightweight layered flat-painterly 2D (gouache-inspired). WebP/SVG layers swapped on a base illustration. Target <5 MB initial browser payload.
- **Audio:** Shared menu music bed (`public/source/audio/music-menu.mp3`) with procedural warm-pad fallback. Procedurally synthesized UI foley (hover, click, claim, locked, footstep) using Web Audio API — 0 KB. Per-shelter procedural hover ambience (wind, water, rustling, hum).

---

## Future / Backlog Ideas

- Weather storms & seasonal lighting shifts
- Scavenging expeditions to neighboring zones
- Radio signals & visitor events
- Optional `.webm` animated shelter backgrounds
- V2 outpost network (multiple shelters connected)
- Journal / quest log with hand-drawn illustrations
- Sound: ambient day/night cycle, rain on roof, campfire crackle
