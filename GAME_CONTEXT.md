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
| `pipe` | Giant Storm Pipe | 🔒 Coming soon | Curved walls, quiet roadside camp | Torn tarp flap, plank windbreak, stone fire ring |
| `tree` | Abandoned Treehouse | 🔒 Coming soon | Half-broken canopy refuge | Crooked plank platform, frayed rope ladder, hanging lantern |
| `countryhouse` | Abandoned Country House | 🔒 Survive 7 days | Ivy cottage, propped porch | Propped porch beam, patched window tarp, crate & lantern |
| `farmhouse` | Abandoned Farmhouse | 🔒 2 upgrades | Fallow beds, timber barn | Porch tarp, salvaged fence planks, watering can & lantern |

### ⛰️ Challenge Mode — Exposed & strategic (still zero permadeath)

| ID | Name | Status | Tagline | Left Behind |
|----|------|--------|---------|-------------|
| `cave` | Hillside Cave | 🔒 Survive 10 days | Dry stone alcove, cold firepit | Collapsed lean-to, stone firepit, wooden crates |
| `bunker` | Sunken Service Bunker | 🔒 1 expansion | Wedged steel door, buried shelter | Wedged steel door, stairwell tarp, rusted toolbox |
| `beachhouse` | Abandoned Beachhouse | 🔒 Survive 14 days | Stilt cabin, salt breeze | Torn porch tarp, driftwood fire ring, wooden crate |
| `island` | Abandoned Island Camp | 🔒 4 upgrades | Driftwood jetty, pine shore | Collapsed branch tent, stone fire ring, supply crate |

> **Terrace-only focus:** **Old Apartment Terrace** is currently the single playable shelter while the core mechanics are perfected. Giant Storm Pipe and Abandoned Treehouse show as **"Coming soon"** and stay locked regardless of milestones; the other 6 keep their milestone requirements. Only the Terrace has an interactive scene today.

---

## Player Identity & Onboarding Flow

1. **Title Screen** — The painted **One Warm Spot** wordmark (ivy & lantern) floating over the sunrise sky, Start / Continue / New Game, plus **About** and **Load Backup** side by side, and the shared menu music. *Load Backup* opens a `.json` picker; a restored run appears straight away as **Continue**, with a friendly toast either way.
2. **Shelter Selector** — Traveler picker (Female / Male sprite portraits), Cozy / Challenge mode tabs, 9 shelter cards with hover background crossfade and procedural ambience.
3. **Arrival Cutscene** — For most shelters, a ~3.5s atmospheric Ken Burns zoom on the shelter background with soft footsteps, swelling ambience and a Day 1 caption. **The Terrace arrives by the old apartment lift** in a ~5.2s, 3-beat illustrated vignette:
   1. **The Quiet Lobby** — a sunlit, ivy-draped hallway; a slow push-in toward the open elevator with a few soft footsteps.
   2. **Riding Up** — inside the old lift (green-painted walls, wood wainscot, brass rails) with the doors closed; a warm amber brass indicator ticks **1 → 2 → 3 → 4 → R** with tiny relay clicks over a low mechanical hum and a gentle 1–2px tremor.
   3. **Doors Open to Sunlight** — a vintage brass *"ding!"*, the doors slide apart onto the sunlit rooftop, the Terrace ambience swells, an *"Old Apartment Terrace"* caption appears, and the view steps through the doorway into the live shelter, where the traveler walks out of the rooftop stairwell door.
   Every cutscene is skippable at any moment (Skip button, click, `Space` / `Enter` / `Escape`) and respects Reduce Motion (no push-ins, tremor or sliding — calm fades instead).
4. **Interactive Shelter** — The point-and-click painted scene (see below), with a minimal floating HUD: a **← Title** button with the lantern emblem and shelter name (top-left), the centered **Found Materials Pouch** (all 7 resources), a bottom-left **Vitality Medallion** (`Day N` plaque, bronze sky medallion, Stamina & Strength bars), and a compact bottom-center **Build Bar** with one next-tier chip per station. If the stage art needs a moment to load, a softly pulsing lantern emblem waits in its place. Progress auto-saves.

---

## 🏙️ Current Terrace Gameplay (Active Vertical Slice — Terrace v2)

- **Stage:** An overgrown apartment rooftop with a crumbling brick parapet and, on the right, an old **brick stairwell/lift bulkhead with an ajar metal door** — where the traveler arrives. The parapet and bulkhead are solid scenery the traveler walks around.
- **Calm arrival:** After the lift cutscene the traveler appears right at the stairwell threshold, pauses for a breath as the rooftop fades in, then takes a slow ~2s stroll a few steps onto the terrace and settles into idle before the player takes over.
- **Traveler:** Real painted **Female / Male** traveler sprites in an understated, faceless **3/4 view** style, with **5 poses** — `idle`, `walk`, `sit`, `sleep`, `search`. Each pose is scaled by anatomical height ratios (so sitting and sleeping read at believable proportions) with pose-adapted soft shadows and smooth crossfades between poses.
- **Click-to-walk:** Click anywhere on the rooftop floor to walk there. Movement stays inside the walkable area, props block the way with **elliptical obstacle colliders**, and everything is **Y-depth sorted** so the traveler passes naturally in front of or behind props.
- **Interactive props:**
  - **Central Fire Pit (3 tiers)** — walk over and light it (flickering flames, embers, warm glow and a looping campfire crackle), and the traveler **sits by the fire**. **Lighting burns 1 🪵 Timber** of firewood (with too little, a gentle toast says *"Need 1 Timber to light the fire"*). Click it again to **extinguish** it with a soft hiss and save fuel. A lit fire is also needed for some grill recipes. At Dusk and Night its radial glow warms up the rooftop. It grows with the shelter:
    - **Tier 1 · Makeshift Twigs** (start) — a modest, delicate flame, sparse sparks and a soft compact glow.
    - **Tier 2 · Stacked Logs** — a taller, livelier multi-tongue flame (deep amber outside, bright gold core), steadier rising embers, a ~35% wider and brighter glow pool, and a fuller crackle.
    - **Tier 3 · Stone-Ring Hearth** — a rich hearth fire: layered dancing flames over a pulsing coal bed, frequent drifting embers, curling translucent smoke wisps, a lush wide golden glow that transforms the rooftop at Dusk and Night, and the richest crackle.
  - **Shelter (3 tiers: Cloth Lean-to → Timber Shelter → Insulated Hut) — Context-Aware Rest & Sleep** — tucked behind-left of the fire pit:
    - During **Day** or **Dusk**, hovering reads **"Rest by shelter"** — clicking sits beside the shelter, restores **+25 Stamina**, and smoothly shifts the sky to the next phase over 1.4s.
    - During **Night**, hovering reads **"Sleep until morning"** — clicking tucks into the bedroll under the shelter in starry twilight, then transitions into **Day N+1 · Morning** with a morning toast. A better shelter means a better night: you wake with at least **75% (T1) → 90% (T2) → 100% (T3) Stamina** (+10% with *Warm Patchwork Sheets*, capped at 100). Strength eases `-10` overnight, or just `-5` in the Insulated Hut. Each new morning the farm is ready to harvest and the rain barrel has refilled.
    - The Timber Shelter's hanging lantern glows at dusk and night; the Insulated Hut glows warmly from its **window and doorway lantern**.
  - **3 searchable box spots, each with distinct art** — broken boxes, a double crate stack, and a single parcel with a leaning plank. Rummage once each (search pose + rummage foley) for Timber, Scrap and Cloth; the broken boxes show a cleared sprite and the others take on a dusty, rummaged look.
  - **6 cleanable weed patches** — 3 weed species (grassy tufts, leafy brush, dandelion clusters), two of each; clearing each (leaf particles + snip foley) yields Seeds and Cloth.
  - **A fresh rooftop every run:** each new game lays the boxes and weeds out differently — new spots, shuffled art, slight size variation (0.92–1.08×) and random flips. Boxes lean toward the parapet edges and corners; weeds scatter across cracks and wall edges. Nothing ever overlaps the fire pit, shelter, farm, barrel, cooking grill or sewing kit (at their largest tier), their stand spots, the stairwell path or each other. The layout is remembered for the whole run (refresh / Continue), and **Start Fresh** rolls a new one. *(This generator is also the groundwork for future rooftop regrowth.)*
  - **Stairwell door** — hovering highlights the ajar door (*"Stairwell downstairs (coming soon)"*); clicking walks the traveler over and a gentle toast says the stairs lead down into the quiet building—more to explore soon.
- **3-Phase Real-Time Day Cycle & Vitality (`Stamina` & `Strength`):**
  - A full day lasts **12 real-time minutes** (`240s` per phase: **Day** Full Sun → **Dusk** Sunset → **Night** Half Moon), paused when outside the shelter or inside Settings. Night holds calmly without harsh pass-outs until the player chooses to sleep.
  - **Stamina (`0–100`, restedness)** is gently spent by clearing weeds (`-6`), searching boxes (`-10`), and building station tiers (`-12`), and restored by resting, sleeping and cooking. *Mended Work Gloves* make weeds and boxes ~30% lighter (`-4` / `-7`); harvesting the farm and collecting rainwater are free.
  - **Strength (`0–100`, nourishment/resilience)** eases gently across phase shifts (`-8`, halved to `-4` with the *Quilted Cozy Cloak*) and overnight (`-10`, or `-5` in the Insulated Hut), non-lethal and zero-stress. Cooking at the grill is the main way to restore it.
  - Displayed in the bottom-left **Vitality Medallion** — a calm, Witcher 3–inspired antique-bronze bezel framing a recessed sky window: a radiant full sun on warm gold by Day, a big sunset sun dipping over a burnt-amber & rose horizon at Dusk, and a luminous half moon over a starry indigo sky at Night. A slim ring inside the bezel tracks the phase, a small **Day N** plaque sits above it, and smoked-glass bars extend to the right for **Stamina** (sage-emerald) and **Strength** (hearth-amber) with `value/100` readouts. In the scene it's paired with **twinkling night stars**, **drifting warm fireflies**, and brighter fire pit / lantern glow pools at night.
- **Six multi-tier stations, built in the scene (no menu drawers):** Spend found materials directly on the rooftop. The compact bottom-center **Build Bar** shows **at most one chip per station — its next tier** (a small `T2` pill, the name and the material cost). Chips you can't afford yet are dimmed and a station's chip disappears once it's maxed. Unbuilt stations (farm, barrel, grill, sewing kit) also glow as soft floor blueprints you can click to build Tier 1. Building walks the traveler over, plays soft mallet foley and a fitting flourish (wood knocks, stone clacks, water chimes, leafy sparkles, a fabric chime), deducts the materials and pops the new tier's art in. Built stations become solid scenery (colliders + Y-sorting).

  | Station | Tiers (cost to build each) |
  |---|---|
  | 🛖 **Shelter** | T1 Cloth Lean-to *(start)* → T2 Timber Shelter `3🪵 2🧵` → T3 Insulated Hut `4🪵 2🔩 2🪨` |
  | 🔥 **Fire Pit** | T1 Twig Fire Pit *(start)* → T2 Stacked Logs `2🪵` → T3 Stone-Ring Hearth `2🪵 1🔩 2🪨` |
  | 🌱 **Farm** | T1 Seedling Crate `1🪵 1🌱` → T2 Herb Planter `2🪵 2🌱` → T3 Trellis Garden `3🪵 2🔩 2🌱` |
  | 💧 **Rainwater Barrel** | T1 Bucket Barrel `1🪵 1🧵` → T2 Rain Barrel `2🪵 2🔩` → T3 Guttered Rain Rig `3🪵 2🔩 2🪨` |
  | 🍳 **Cooking Grill** | T1 Grill Rack `1🔩 1🪨` → T2 Camp Grill `2🔩 2🪨` → T3 Grill Counter `2🪵 2🪨 1🔩` → T4 Hearth Kitchen `4🪵 2🔩 2🪨` |
  | 🧵 **Sewing / Knitting Kit** | T1 Needle & Thread `1🧵` → T2 Patch Scraps `2🧵` → T3 Knitting Basket `2🪵 2🧵` → T4 Mending Bench `3🪵 2🧵 1🔩` → T5 Sewing Table `4🪵 3🧵 2🔩` |

  These stations are separate from the paused 10 macro upgrades: they don't yet raise the Cozy Index or count toward milestone unlocks.
- **The Vitality & Crafting loop:**
  - **🌱 Farm harvest** — click the built farm: the traveler walks over and gathers with a soft rustle for **+1 / +2 / +3 🍅 Food** by tier (plus **+1 🌱 Seed** from T2). Then it reads *"Growing — ready tomorrow"* until the next morning.
  - **💧 Rainwater** — click the built barrel for **+1 / +2 / +3 💧 Water** by tier with a splash chime; it refills each morning (*"Filling — ready tomorrow"*).
  - **🍳 Cooking** — click the built grill to open a small frosted **Cooking** popover. Recipes unlock by grill tier; cooking uses the ingredients, restores Stamina & Strength at once (capped at 100), and fills the air with a gentle sizzle, rising steam and floating feedback:

    | Recipe | Grill | Ingredients | Restores |
    |---|---|---|---|
    | 💧 Cool Rainwater | T1 | `1💧` | +10 ⚡ · +5 ❤️ |
    | 🌰 Toasted Seeds | T1 · needs a lit fire | `1🌱` | +15 ❤️ |
    | 🍵 Warm Herbal Tea | T2 · needs a lit fire | `1🍅 1💧` | +30 ⚡ · +10 ❤️ |
    | 🍲 Rooftop Veggie Stew | T3 | `2🍅 1💧` | +15 ⚡ · +45 ❤️ |
    | 🥘 Hearth Spiced Feast | T4 | `2🍅 1🌱 1💧` | +40 ⚡ · +65 ❤️ |

  - **🧵 Mending** — click the built sewing kit to open a **Mending** popover of permanent cozy perks (each crafted once, with a soft fabric chime):
    - 🛏️ **Warm Patchwork Sheets** *(T1, `2🧵`)* — +10% Stamina when you sleep.
    - 🧤 **Mended Work Gloves** *(T3, `2🧵 1🔩`)* — clearing weeds & searching boxes costs ~30% less Stamina.
    - 🧥 **Quilted Cozy Cloak** *(T5, `4🧵 1🪵`)* — halves Strength drift as the day turns *(and lays the groundwork for future traveler clothing sprites)*.
  - Popovers explain anything that's missing (*"Needs Grill T3"*, *"Light the fire pit first"*, *"Need 2 🍅 more"*) and close with `Escape` or a click elsewhere.
- **Found Materials Pouch:** A minimal, centered pouch showing all **7 resources — 🪵 Timber · 🧵 Cloth · 🌱 Seeds · 💧 Water · 🔩 Scrap · 🪨 Stone · 🍅 Food** — compact enough for small windows, each pulsing when it grows.
- **🧪 Generous test supplies (temporary):** While the stations are being tuned, every freshly claimed shelter starts with a generous pool (`40🪵 15🧵 10🌱 8💧 20🔩 16🪨 6🍅`). Together with the rooftop's boxes and weeds, that's enough to try every station tier, every recipe and every mending perk right away. It's behind a clearly marked `TEST_MODE_GENEROUS_START` switch, and scarcity will be tuned once downstairs scavenging arrives.
- **Persistence:** Fire state, every station's tier, today's farm/barrel readiness, crafted perks, the box & weed layout, searched boxes and cleared weeds are remembered between visits. Older rooftops migrate gently (earlier one-off builds become Tier 2 of their station). Claiming a new shelter or resetting starts the Terrace fresh with a new layout.

---

## 7 Core Resources

| Resource | Emoji | Cozy Day 1 Amount* | Where it comes from on the Terrace today |
|----------|-------|-------------------|-----------------------------|
| Timber | 🪵 | 4 | ✅ Boxes |
| Cloth | 🧵 | 2 | ✅ Boxes & weeds |
| Seeds | 🌱 | 1 | ✅ Weeds, Farm T2+ |
| Water | 💧 | 5 | ✅ Rainwater barrel |
| Scrap | 🔩 | 3 | ✅ Boxes |
| Stone | 🪨 | 2 | — (downstairs, later) |
| Food | 🍅 | 0 | ✅ Farm harvest |

\* Normal Day 1 amounts (Challenge: ~60%, never below 1 of anything stocked; Food always starts at 0). While `TEST_MODE_GENEROUS_START` is on, fresh runs use the generous test pool instead. Saves and backups from before Food existed load with `0 🍅`.

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

- **Visual style:** Lightweight layered flat-painterly 2D (gouache-inspired). WebP backgrounds, stage backdrops, cutscene plates, character pose sprites, and interactive prop sprites organized under `public/source/`. Target <5 MB initial browser payload. Interactive stages stay locked to their painted floor on any window shape (16:9, ultrawide or portrait).
- **Brand:** A painted ivy-and-lantern **wordmark** (`public/source/ui/logo-title.webp`) on the Title Screen, and a round **lantern emblem** (`logo-emblem.webp`) used as the About crest, the shelter HUD badge and the loading emblem. Browser tab icon: `favicon.png`; home-screen icon: `apple-touch-icon.png`.
- **About & copy:** Player-facing and warm — a short story intro, three "How to play" tips, and a quiet `One Warm Spot · v0.1` footer. No technical wording.
- **Comfort & accessibility:** **Reduce Motion** (Settings) calms camera zoom, elevator shake, particles, fire flicker and UI animations: steady fire glow with no sparks or smoke, still fireflies and stars, no leaf bursts, reward text that fades in place, no pouch bounce, and instant sky/HUD transitions.
- **Backups:** Export / Load Backup saves a single `.json` with the whole run — day, vitality, all 7 materials, milestone stats **and the Terrace rooftop** (every station tier, farm/barrel readiness, crafted perks, fire, layout, searched boxes, cleared weeds). Older backups still load: missing Food becomes 0, earlier one-off builds become Tier 2 stations, and a backup without rooftop details starts the Terrace fresh.
- **Characters:** Understated, faceless 3/4-view travelers in ragged earthy gear, painted to match the backdrops.
- **Audio:** Menu music tries an optional `public/source/audio/music-menu.mp3`; since that file isn't shipped yet, the **procedural warm-pad chord loop** is what currently plays. Procedurally synthesized UI and in-shelter foley (hover, click, claim, locked, footstep, fire ignition + looping campfire crackle that grows fuller with each fire pit tier, fire extinguish hiss, box rummage, weed snip, bedroll sleep, rest chime, building mallet taps, log-stacking knocks, hearth stone clacks, rain-barrel water-drop chimes, farm harvest rustle, grill sizzle & kettle, sewing fabric chime, and the Terrace lift's low hum, door slides, floor-tick relay clicks and brass arrival ding) using Web Audio API — 0 KB. Per-shelter **musical** ambience — soft pitched voices and spaced organic micro-events rather than noise hiss (terrace birdsong & bamboo chimes, pipe drips in a hollow hum, treehouse marimba & creaks, country-house pentatonic chimes, farmhouse barn creaks, cave echo pings, bunker room tone & relay ticks, beachhouse rolling surf, island lapping shore & pine harmonic). Plays on hover and softly while in the shelter.

---

## 🗺️ Design Roadmap (Next Up)

- **🔥 Wood-Burning Fire Mechanic (next step):** Lighting the fire already burns 1 Timber; next, a lit campfire should slowly consume more **Timber** over time, turning the extinguish toggle into a meaningful, cozy resource choice (keep warm and bright, or save wood for building).
- **🚪 Beyond-the-Roof Gathering & Mixed Rooftop Regeneration:** Mix slow, gentle rooftop regeneration (new sprouts/debris over days) with stepping out through the **stairwell door** into simple, cozy mini-puzzles inside the quiet apartment building to gather extra Timber, Scrap, Stone, and Water. Once it lands, switch off `TEST_MODE_GENEROUS_START` and tune scarcity.
- **📦 More Prop Variety:** A dedicated **lit fire-pit sprite**, plus "cleared" variants for the double crate and single parcel.
- **🛠️ More In-Scene Visual Upgrades:** Beyond the six multi-tier stations — repairing the parapet walls, string lights, and other new **anchor spots**.
- **👕 Traveler Clothing Progression:** Start in ragged earthy traveler gear and unlock cleaner, warmer, cozier outfits as the shelter improves — the *Quilted Cozy Cloak* perk is the first hook for a Tier 2 outfit sprite.
- **🌅 Full Time-of-Day Scenes & More Arrival Vignettes:** Dedicated **Morning / Afternoon / Evening / Night** painted backdrops (and time-specific props) instead of tint-only lighting, plus per-shelter intro vignettes for the other 8 shelters (the Terrace lift ride is the template).
- **🏠 More Interactive Shelters:** Bring the remaining 8 shelters to life with their own scene configs, props, hotspots and buildables.
- **🌱 Rooftop Regrowth:** Reuse the per-run layout generator to let a few new sprouts and debris gently reappear over the days.

### ✅ Shipped from the roadmap (Terrace v2)

- Rooftop **stairwell/lift entrance** stage with the traveler arriving through its door, and the **shabby cloth lean-to** beside the fire pit as the sleeping spot.
- **Single / double box** sprites and a **third weed species**, so no two gathering spots look alike.
- First **in-scene visual upgrades**: reinforce the cloth lean-to into a timber shelter, a raised herb planter, and a rain barrel.
- **Terrace arrival vignette**: the 3-beat lobby → lift ride → doors-open-to-sunlight elevator cutscene, ending in a calm stroll out of the stairwell.
- **New day rhythm**: the real-time Day → Dusk → Night cycle, with resting and sleeping at the shelter advancing the day and milestone unlocks.
- **3-tier fire pit** (twigs → stacked logs → stone-ring hearth) with fire, glow and crackle that grow each tier.
- **Randomized box & weed layout** per run.
- **Core Vitality & Multi-Tier Progression loop:** 🍅 Food as the 7th resource; six multi-tier stations (Shelter, Fire Pit, Farm, Rainwater Barrel, Cooking Grill, Sewing Kit); daily harvest & rainwater; grill cooking that restores Stamina & Strength; mending perks; shelter-tier sleep comfort; firewood cost to light the fire.

---

## Future / Backlog Ideas

- Weather visuals on the shelter scene (rain streaks, squall haze, rain-on-roof ambience) & seasonal lighting shifts
- Multi-day scavenging expeditions to farther zones
- Radio signals & visitor events
- Optional `.webm` animated shelter backgrounds
- V2 outpost network (multiple shelters connected)
- Journal / quest log with hand-drawn illustrations
- 📔 **Found Traveler Diary Pages / Two-Tab Cozy Scrapbook** *(parked story idea)* — torn diary pages left by earlier travelers turn up while exploring, gently telling their story; they're kept in a cozy two-tab scrapbook alongside your own keepsakes.
- Sound: ambient day/night cycle
