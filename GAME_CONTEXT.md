# One Warm Spot — Game Context & Design Bible

> **One Warm Spot** is a single-player, cozy, low-difficulty post-apocalyptic survival and shelter-building browser game. It sits closer to *I Am Future* than *Fallout Shelter*—sunlit, restorative, and eye-soothing.

---

## Vision & Elevator Pitch

An asteroid shook the Earth, but the dust has settled. Skies are clearing, sunlight is returning, and somewhere in a quiet valley there is **one warm spot** waiting to become home. You are a lone survivor—not a warrior, just someone who wants a safe place to sleep, a small garden, and a reason to keep going. Find a weathered campsite left by an earlier traveler, patch it up, and build a cozy shelter one upgrade at a time.

---

## 🧭 Current Direction — A Living, Point-and-Click Shelter

The game has **pivoted away from menu-drawer clicking** toward a **living, point-and-click illustrated scene**. Instead of pressing buttons in side drawers, you walk your traveler around a painted shelter and interact directly with the things left behind.

- **Active vertical slice:** **Old Apartment Terrace** is the first fully interactive shelter and the template every other shelter will follow.
- **Paused on purpose:** The earlier M1 drawer-based loop—Rest / Sleep-to-next-day buttons, the Valley Scavenge drawer, the Upgrade drawer and the Survival Kit drawer—is **intentionally paused** (code kept, not mounted) while we rethink how **gathering**, the **day rhythm** and **visual upgrades** should work *inside* the scene. Terrace v2 is the first step: its visual upgrades are now built directly in the scene. See [Paused M1 Systems](#paused-m1-systems-implemented-dormant).

---

## World & Lore

- **Setting:** Quiet post-asteroid impact valley; dust has cleared, weather is stabilizing.
- **Tone:** Sunlit recovery, not bleak survival. No monsters, no raiders, no permadeath.
- **Previous travelers:** Every shelter site shows half-broken traces of someone who camped temporarily and moved on—sagging tarps, cold firepits, abandoned crates. The player inherits these traces and repairs them.

---

## Core Design Pillars

1. **Zero permadeath, zero raids, zero time pressure.** The game is intentionally low-stress.
2. **Live in the scene.** Gathering, resting and building happen by walking to and clicking things in the painted shelter—not through menus.
3. **Guided macro-building** instead of granular free-grid furniture or light placement:
   - **Shell tiers** — patch, reinforce, fortify the outer walls/roof.
   - **Preset room dividers** — hang cloth, then build timber frames.
   - **Footprint expansions** — repair a lean-to, then add a full extension.
   - **5–6 curated anchor slots** — workbench, garden bed, rain collector, hearth, etc.
4. **Cozy at every layer:** palette, audio, pacing, and copy.

---

## Shelter Sites (9 total)

### ☀️ Cozy Mode — Relaxed & forgiving

| ID | Name | Status | Tagline | Left Behind |
|----|------|--------|---------|-------------|
| `terrace` | Old Apartment Terrace | ✅ Unlocked · 🎮 Interactive scene | Sunlit rooftop, half-pitched camp | Sagging tarp, crate table, salvaged planks |
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

> Only the Terrace has an interactive scene today. The other 8 shelters currently show their painted background with the traveler on a generic walkable floor (no hotspots) until their own scene configs are authored.

---

## Player Identity & Onboarding Flow

1. **Title Screen** — Game title, Start / Continue / About buttons, shared menu music.
2. **Shelter Selector** — Traveler picker (Female / Male sprite portraits), Cozy / Challenge mode tabs, 9 shelter cards with hover background crossfade and procedural ambience.
3. **Arrival Cutscene** (~3.5s) — Smooth atmospheric Ken Burns zoom on the chosen shelter background, soft footsteps and shelter ambience swelling in, Day 1 title caption fade-in, skippable, crossfading cleanly into the playable shelter where the traveler walks onto the stage (on the Terrace, they fade in and step out of the ajar rooftop stairwell door).
4. **Interactive Shelter** — The point-and-click painted scene (see below), with a minimal floating HUD: a **← Title** button with the shelter name (top-left), the centered **Found Materials Pouch**, and a tiny bottom-center **Build Bar** while in-scene upgrades remain. Progress auto-saves.

---

## 🏙️ Current Terrace Gameplay (Active Vertical Slice — Terrace v2)

- **Stage:** An overgrown apartment rooftop with a crumbling brick parapet and, on the right, an old **brick stairwell/lift bulkhead with an ajar metal door** — where the traveler arrives. The parapet and bulkhead are solid scenery the traveler walks around.
- **Traveler:** Real painted **Female / Male** traveler sprites in an understated, faceless **3/4 view** style, with **5 poses** — `idle`, `walk`, `sit`, `sleep`, `search`. Each pose is scaled by anatomical height ratios (so sitting and sleeping read at believable proportions) with pose-adapted soft shadows and smooth crossfades between poses.
- **Click-to-walk:** Click anywhere on the rooftop floor to walk there. Movement stays inside the walkable area, props block the way with **elliptical obstacle colliders**, and everything is **Y-depth sorted** so the traveler passes naturally in front of or behind props.
- **Interactive props:**
  - **Central Fire Pit** — walk over and light it (flickering flames, embers, warm glow and a looping campfire crackle), and the traveler **sits by the fire**. Click it again to **extinguish** it with a soft hiss.
  - **Shabby Cloth Lean-to** — a patched cloth tent tucked behind-left of the fire pit. Click it and the traveler crawls in and **sleeps** tucked under the cloth roof while the scene dims to a cozy twilight. *(Currently a resting moment only — it does not yet advance the day.)*
  - **3 searchable box spots, each with distinct art** — broken boxes by the back-left parapet, a double crate stack in the front-left corner, and a single parcel with a leaning plank by the back-right parapet. Rummage once each (search pose + rummage foley) for Timber, Scrap and Cloth; the broken boxes show a cleared sprite and the others take on a dusty, rummaged look.
  - **6 cleanable weed patches** — 3 weed species (grassy tufts, leafy brush, dandelion clusters) at varied sizes and flips along the parapet and concrete cracks; clearing each (leaf particles + snip foley) yields Seeds and Cloth.
  - **Stairwell door** — hovering highlights the ajar door (*"Stairwell downstairs (coming soon)"*); clicking walks the traveler over and a gentle toast says the stairs lead down into the quiet building—more to explore soon.
- **In-scene building (no menu drawers):** Spend found materials directly on the rooftop. A tiny bottom-center **Build Bar** shows a frosted chip for each unbuilt upgrade with its material cost; chips you can't afford yet are dimmed. Planter and barrel spots also glow as soft blueprint markers on the floor that can be clicked directly. Building walks the traveler over, plays soft mallet foley and a warm chime, deducts the materials from the pouch, and pops the new prop in:
  - **🛖 Upgrade Shelter** (3 🪵 + 2 🧵) — the cloth lean-to becomes a **cozy timber shelter** with a bedroll and a hanging lantern that glows warmly at dusk, at night and while you sleep.
  - **🌿 Herb Planter** (2 🪵 + 2 🌱) — a raised planter of herbs and tomatoes by the left parapet, with a leafy sparkle burst.
  - **🛢️ Rain Barrel** (2 🔩 + 1 🪵) — a rainwater barrel beside the stairwell bulkhead, with gentle water-drop chimes.
  - Built props become solid scenery (colliders + Y-sorting). The Build Bar vanishes once all three are built. The rooftop's boxes and weeds alone yield enough for all three.
  - These Terrace buildables are separate from the paused 10 macro upgrades: they don't yet raise the Cozy Index or count toward milestone unlocks.
- **Found Materials Pouch:** A minimal, centered pouch that pulses when something new is found. It currently surfaces only the **4 Terrace-gatherable materials — 🪵 Timber, 🔩 Scrap, 🧵 Cloth, 🌱 Seeds**. **🪨 Stone & 💧 Water are intentionally held back** until in-scene sources for them exist.
- **Persistence:** Fire state, searched boxes, cleared weeds and built upgrades are remembered between visits; claiming a new shelter or resetting starts the Terrace fresh.

---

## 6 Core Resources

| Resource | Emoji | Cozy Day 1 Amount | Gatherable on Terrace today |
|----------|-------|-------------------|-----------------------------|
| Timber | 🪵 | 4 | ✅ Boxes |
| Scrap | 🔩 | 3 | ✅ Boxes |
| Cloth | 🧵 | 2 | ✅ Boxes & weeds |
| Stone | 🪨 | 2 | — (held back) |
| Seeds | 🌱 | 1 | ✅ Weeds |
| Water | 💧 | 5 | — (held back) |

---

## Day 1 Survival Kit

Canvas Tarp ⛺, Bedroll & Pack 🎒, Pocket Stove 🔥, Multi-Tool 🛠️, Field Journal 📓 — each with a short note on how it helps. *(The Survival Kit drawer is part of the paused M1 UI; the kit data is kept for a future in-scene presentation.)*

---

## Paused M1 Systems (Implemented, Dormant)

These systems are fully implemented and unit-tested in the game engine, but their drawer UI is **not mounted** in the current shelter screen. They are the reference rules we will reshape into in-scene interactions.

### Daily Rhythm & Building

- **Time of day:** Morning → Afternoon → Dusk → Night, each with its own lighting on the painted shelter (golden morning, soft afternoon, amber-peach dusk, cozy twilight night). *(The scene lighting still follows the saved time of day; there is just no in-scene way to advance it yet.)*
- **Rest & Sleep:** resting moves to the next phase and restores a little energy; sleeping at night starts the next day fully rested (*"Morning of Day N"*). No time pressure — nothing bad happens while you rest.
- **Energy:** building takes effort (15–40 energy); when tired, simply rest.
- **10 macro upgrades** across Shell, Dividers, Expansions and Curated Slots. Pitching & patching the canvas tarp is Shell · Tier 1. Each upgrade adds to the **Cozy Index** (0–100) and visibly warms the scene.
- **Lantern:** at dusk the old lantern can be lit with the pocket stove — it glows every evening after.
- **Milestones:** surviving days and completing upgrades unlock new shelters permanently (kept even when you start a new camp). *(Because day progression and building are paused, milestone unlocks cannot currently be earned in play.)*

### Scavenging, Weather & Valley Relics

- **Surface scavenging (morning & afternoon):** short trips to four nearby spots — the **Overgrown Highway** (scrap, cloth), **Fallen Pine Grove** (timber, seeds), **Crumbling Stone Creek** (stone, water) and **Shattered Greenhouse** (seeds, cloth, scrap). A trip spends energy and one part of the day, always brings something home, and comes back with a small warm story. A cozier shelter (every 25 Cozy Index) means an extra find on each trip.
- **Valley Relics:** now and then a trip turns up a keepsake left by earlier travelers — a *Faded Postcard*, a *Weather Station Log*, a *Cracked Cassette*… Each is tucked into the **Field Journal** to re-read any time.
- **Gentle daily weather:** each morning is *Clear*, *Breezy*, *Soft Rain* (a few cups of free water, more with a rain collector) or, rarely, a *Dust Squall* that keeps you in for the morning. Fortified walls let you brave it.

## ☀️ Cozy vs. ⛰️ Challenge

Both modes keep the promise: **zero permadeath, zero raids, zero time pressure**.

| | Cozy | Challenge |
|---|---|---|
| Arrive with | Full Day 1 materials | ~60% (still enough to pitch the tarp) |
| Scavenging trip *(paused)* | ⚡25, generous finds | ⚡35, slightly tighter finds |
| Weather | Mostly clear, breezy & soft rain; storms rare | Dust squall mornings are common |

---

## Art & Audio Direction

- **Visual style:** Lightweight layered flat-painterly 2D (gouache-inspired). WebP backgrounds, stage backdrops, character pose sprites, and interactive prop sprites organized under `public/source/`. Target <5 MB initial browser payload.
- **Characters:** Understated, faceless 3/4-view travelers in ragged earthy gear, painted to match the backdrops.
- **Audio:** Menu music tries an optional `public/source/audio/music-menu.mp3`; since that file isn't shipped yet, the **procedural warm-pad chord loop** is what currently plays. Procedurally synthesized UI and in-shelter foley (hover, click, claim, locked, footstep, fire ignition + looping campfire crackle, fire extinguish hiss, box rummage, weed snip, bedroll sleep, building mallet taps, rain-barrel water-drop chimes) using Web Audio API — 0 KB. Per-shelter **musical** ambience — soft pitched voices and spaced organic micro-events rather than noise hiss (terrace birdsong & bamboo chimes, pipe drips in a hollow hum, treehouse marimba & creaks, country-house pentatonic chimes, farmhouse barn creaks, cave echo pings, bunker room tone & relay ticks, beachhouse rolling surf, island lapping shore & pine harmonic). Plays on hover and softly while in the shelter.

---

## 🗺️ Design Roadmap (Next Up)

- **🔥 Wood-Burning Fire Mechanic:** A lit campfire slowly consumes **Timber** over time, turning the extinguish toggle into a meaningful, cozy resource choice (keep warm and bright, or save wood for building).
- **🚪 Beyond-the-Roof Gathering:** Once the rooftop boxes and weeds are cleared, the **lift/stairwell door** (already on the Terrace v2 stage as a "coming soon" hotspot) becomes the natural in-scene way to explore downstairs or outside for more materials (the in-scene successor to the paused Scavenge drawer, and a home for Stone & Water sources).
- **📦 More Prop Variety:** A dedicated **lit fire-pit sprite**, plus "cleared" variants for the double crate and single parcel.
- **🛠️ More In-Scene Visual Upgrades:** Build on the Terrace v2 trio (timber shelter, herb planter, rain barrel) with more **anchor spots** — repairing the parapet walls, string lights, and second-tier versions of existing props.
- **👕 Traveler Clothing Progression:** Start in ragged earthy traveler gear and unlock cleaner, warmer, cozier outfits as the shelter improves.
- **🌅 Full Time-of-Day Scenes & Custom Arrival Vignettes:** Dedicated **Morning / Afternoon / Evening / Night** painted backdrops (and time-specific props) instead of tint-only lighting, plus per-shelter intro vignettes (e.g., the lift/stairwell door swinging open onto the Terrace).
- **🌙 New Day Rhythm:** Reconnect sleeping (in the lean-to / timber shelter) to day progression and milestone unlocks once the in-scene day loop is finalized.
- **🏠 More Interactive Shelters:** Bring the remaining 8 shelters to life with their own scene configs, props, hotspots and buildables.

### ✅ Shipped from the roadmap (Terrace v2)

- Rooftop **stairwell/lift entrance** stage with the traveler arriving through its door, and the **shabby cloth lean-to** beside the fire pit as the sleeping spot.
- **Single / double box** sprites and a **third weed species**, so no two gathering spots look alike.
- First **in-scene visual upgrades**: reinforce the cloth lean-to into a timber shelter, a raised herb planter, and a rain barrel.

---

## Future / Backlog Ideas

- Weather visuals on the shelter scene (rain streaks, squall haze, rain-on-roof ambience) & seasonal lighting shifts
- Multi-day scavenging expeditions to farther zones
- Radio signals & visitor events
- Optional `.webm` animated shelter backgrounds
- V2 outpost network (multiple shelters connected)
- Journal / quest log with hand-drawn illustrations
- Sound: ambient day/night cycle
