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
2. **Shelter Selector** — Traveler picker (Female / Male sprite portraits), Cozy / Challenge mode tabs, 9 shelter cards with hover background crossfade and procedural ambience.
3. **Arrival Cutscene** (~3.5s) — Ken Burns zoom on the chosen shelter background, animated traveler sprite walking toward the site, Day 1 caption fade-in, skippable.
4. **Day 1 Interactive Shelter** — Point-and-click illustrated scene (starting with **Old Apartment Terrace** as the reusable vertical slice): click anywhere on the floor to walk around, interact directly with props (light the fire pit for campfire glow and crackle, rummage broken boxes for Scrap & Timber, clear overgrown weeds for Seeds & Cloth, or rest under the shed), with a minimal floating HUD displaying the shelter name and Found Materials Pouch.

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

Canvas Tarp ⛺, Bedroll & Pack 🎒, Pocket Stove 🔥, Multi-Tool 🛠️, Field Journal 📓 — viewable any time from the shelter's **Survival Kit** drawer, each with a short note on how it helps.

---

## Daily Rhythm & Building

- **Time of day:** Morning → Afternoon → Dusk → Night, each with its own lighting on the painted shelter (golden morning, soft afternoon, amber-peach dusk, cozy twilight night).
- **Rest & Sleep:** resting moves to the next phase and restores a little energy; sleeping at night starts the next day fully rested (*"Morning of Day N"*). No time pressure — nothing bad happens while you rest.
- **Energy:** building takes effort (15–40 energy); when tired, simply rest.
- **10 macro upgrades** across Shell, Dividers, Expansions and Curated Slots. Pitching & patching the canvas tarp is Shell · Tier 1. Each upgrade adds to the **Cozy Index** (0–100) and visibly warms the scene.
- **Lantern:** at dusk the old lantern can be lit with the pocket stove — it glows every evening after.
- **Milestones:** surviving days and completing upgrades unlock new shelters permanently (kept even when you start a new camp).

---

## Scavenging, Weather & Valley Relics

- **Surface scavenging (morning & afternoon):** short trips to four nearby spots — the **Overgrown Highway** (scrap, cloth), **Fallen Pine Grove** (timber, seeds), **Crumbling Stone Creek** (stone, water) and **Shattered Greenhouse** (seeds, cloth, scrap). A trip spends energy and one part of the day, always brings something home, and comes back with a small warm story. A cozier shelter (every 25 Cozy Index) means an extra find on each trip. At dusk the valley grows dim — rest by the lantern until morning.
- **Valley Relics:** now and then a trip turns up a keepsake left by earlier travelers — a *Faded Postcard*, a *Weather Station Log*, a *Cracked Cassette*… Each is tucked into the **Field Journal** to re-read any time.
- **Gentle daily weather:** each morning is *Clear*, *Breezy*, *Soft Rain* (a few cups of free water, more with a rain collector) or, rarely, a *Dust Squall* that keeps you in for the morning — a cozy excuse to craft or rest. Fortified walls let you brave it.

## ☀️ Cozy vs. ⛰️ Challenge

Both modes keep the promise: **zero permadeath, zero raids, zero time pressure**.

| | Cozy | Challenge |
|---|---|---|
| Arrive with | Full Day 1 materials | ~60% (still enough to pitch the tarp) |
| Scavenging trip | ⚡25, generous finds | ⚡35, slightly tighter finds |
| Weather | Mostly clear, breezy & soft rain; storms rare | Dust squall mornings are common |

---

## Art & Audio Direction

- **Visual style:** Lightweight layered flat-painterly 2D (gouache-inspired). WebP backgrounds, stage backdrops, character pose sprites, and interactive prop sprites organized under `public/source/`. Target <5 MB initial browser payload.
- **Audio:** Shared menu music bed (`public/source/audio/music-menu.mp3`) with procedural warm-pad fallback. Procedurally synthesized UI and in-shelter foley (hover, click, claim, locked, footstep, fire ignition + looping campfire crackle, box rummage, weed snip, bedroll sleep) using Web Audio API — 0 KB. Per-shelter **musical** ambience — soft pitched voices and spaced organic micro-events rather than noise hiss (terrace birdsong & bamboo chimes, pipe drips in a hollow hum, treehouse marimba & creaks, country-house pentatonic chimes, farmhouse barn creaks, cave echo pings, bunker room tone & relay ticks, beachhouse rolling surf, island lapping shore & pine harmonic). Plays on hover and softly while in the shelter.

---

## Future / Backlog Ideas

- Weather visuals on the shelter scene & seasonal lighting shifts
- Multi-day scavenging expeditions to farther zones
- Radio signals & visitor events
- Optional `.webm` animated shelter backgrounds
- V2 outpost network (multiple shelters connected)
- Journal / quest log with hand-drawn illustrations
- Sound: ambient day/night cycle, rain on roof, campfire crackle
