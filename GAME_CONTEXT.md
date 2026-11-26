# One Warm Spot — Game Context & Design Bible

> **One Warm Spot** is a single-player, cozy, low-difficulty post-apocalyptic survival and shelter-building browser game. It sits closer to *I Am Future* than *Fallout Shelter*—sunlit, restorative, and eye-soothing.

---

## Vision & Elevator Pitch

An asteroid shook the Earth, but the dust has settled. Skies are clearing, sunlight is returning, and somewhere in a quiet valley there is **one warm spot** waiting to become home. You are a lone survivor—not a warrior, just someone who wants a safe place to sleep, a small garden, and a reason to keep going. Find a weathered campsite left by an earlier traveler, patch it up, and build a cozy shelter one upgrade at a time.

---

## 🧭 Current Direction — A Living, Point-and-Click Shelter

The game has **pivoted away from menu-drawer clicking** toward a **living, point-and-click illustrated scene**. Instead of pressing buttons in side drawers, you walk your traveler around a painted shelter and interact directly with the things left behind.

- **Active vertical slice:** **Old Apartment Terrace** is the first fully interactive shelter and the template every other shelter will follow.
- **Paused on purpose:** The earlier M1 drawer-based loop—Rest / Sleep-to-next-day buttons, the Valley Scavenge drawer, the Upgrade drawer and the Survival Kit drawer—is **intentionally paused** (code kept, not mounted). Its replacements now live *inside* the scene, built up step by step:
  - **Day rhythm:** a real-time Day → Dusk → Night cycle, with rest and sleep at the shelter.
  - **Visual upgrades:** six multi-tier stations built in the scene.
  - **Gathering:** rooftop boxes and weeds that regrow overnight, plus a lobby downstairs that will grow into the next gathering area.

  See [Paused M1 Systems](#paused-m1-systems-implemented-dormant).

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

1. **Title Screen** — The painted **One Warm Spot** wordmark (ivy & lantern) floating cleanly over the sunrise sky (soft drop-shadow, no dark backdrop box), Start / Continue / New Game, plus **About** and **Load Backup** side by side, and the shared menu music. *Load Backup* opens a `.json` picker; a restored run appears straight away as **Continue**, with a friendly toast either way.
2. **Shelter Selector** — Traveler picker (Female / Male sprite portraits), Cozy / Challenge mode tabs with uniform `38px` top-bar toggles, and 9 shelter cards laid out in centered flex rows (`justify-content: center`) with hover background crossfade and procedural ambience.
3. **Arrival Cutscene** — For most shelters, a ~3.5s atmospheric Ken Burns zoom on the shelter background with soft footsteps, swelling ambience and a Day 1 caption. **The Terrace arrives by the old apartment lift** in a ~5.2s, 3-beat illustrated vignette:
   1. **The Quiet Lobby** — a sunlit, ivy-draped hallway; a slow push-in toward the open elevator with a few soft footsteps.
   2. **Riding Up** — inside the old lift (green-painted walls, wood wainscot, brass rails) with the doors closed; a warm amber brass indicator ticks **1 → 2 → 3 → 4 → R** with tiny relay clicks over a low mechanical hum and a gentle 1–2px tremor.
   3. **Doors Open to Sunlight** — a vintage brass *"ding!"*, the doors slide apart onto the sunlit rooftop, the Terrace ambience swells, an *"Old Apartment Terrace"* caption appears, and the view steps through the doorway into the live shelter, where the traveler walks out of the rooftop stairwell door.
   Every cutscene is skippable at any moment (Skip button, click, `Space` / `Enter` / `Escape`) and respects Reduce Motion (no push-ins, tremor or sliding — calm fades instead).
4. **Interactive Shelter** — The point-and-click painted scene (see below), with a minimal floating HUD: a **← Title** button with the lantern emblem and shelter name (top-left), the centered **Found Materials Pouch** (all 7 resources, each with an instant parchment hover/focus tooltip pill naming the resource), and a bottom-left **Vitality Medallion** (`Day N` plaque, bronze sky medallion, Stamina & Strength bars). Crafting and upgrading happen directly in-world via floor blueprints and contextual prop menus above each station. If the stage art needs a moment to load, a softly pulsing lantern emblem waits in its place. Progress auto-saves.
5. **Ride Down to the Lobby (Terrace)** — Clicking the rooftop's ajar stairwell door walks the traveler over and plays the lift ride in reverse (~5s, same skip rules and Reduce Motion fades):
   1. **Stepping In** — the view pulls back from the rooftop into the lift; the sunlit Terrace is framed in the open doorway, then the doors slide shut and the rooftop ambience falls quiet.
   2. **Riding Down** — the amber indicator ticks **R → 4 → 3 → 2 → 1** over the hum and tremor.
   3. **Doors Open on the Lobby** — a *"ding!"*, the doors slide apart onto the ivy-draped ground-floor hallway, a *"Ground Floor · Lobby"* caption, and the view steps out into it.

   The lobby then becomes a small interactive scene: hovering the **apartment doors** (Apartment 1A, Apartment 1B and the open side doorway) gives them a warm glowing outline and a name tag. Clicking one makes the glow flare and shows a gentle **"Coming soon"** toast. Clicking the **lift** (or the **↑ Rooftop** button, top-left) rides back up through the arrival lift vignette, and the traveler strolls back out of the stairwell door. The day clock rests while you're downstairs.

---

## 🏙️ Current Terrace Gameplay (Active Vertical Slice — Terrace v2)

- **Stage:** An overgrown apartment rooftop with a crumbling brick parapet and, on the right, an old **brick stairwell/lift bulkhead with an ajar metal door** — where the traveler arrives. The parapet and bulkhead are solid scenery the traveler walks around.
- **Calm arrival:** After the lift cutscene the traveler appears right at the stairwell threshold, pauses for a breath as the rooftop fades in, then takes a slow ~2s stroll a few steps onto the terrace and settles into idle before the player takes over.
- **Traveler:** Real painted **Female / Male** traveler sprites in an understated, faceless **3/4 view** style, with **5 poses** — `idle`, `walk`, `sit`, `sleep`, `search`. Each pose is scaled by anatomical height ratios (so sitting and sleeping read at believable proportions) with pose-adapted soft shadows and smooth crossfades between poses.
- **Click-to-walk:** Click anywhere on the rooftop floor to walk there. Movement stays inside the walkable area, props block the way with **elliptical obstacle colliders**, and everything is **Y-depth sorted** so the traveler passes naturally in front of or behind props.
- **Hover feedback:** hovering a prop shows a small parchment label, gives the sprite a warm tint and lifts it ~3% (no lift under Reduce Motion). Empty build slots brighten their floor blueprint.
- **Composed rooftop:** The shelter, fire pit and stairwell door sit at fixed architectural spots, and **four flexible build slots** hug the brick walls. Together they form three zones that leave the middle of the rooftop open to walk:
  - **Living & Mending nook** (back-left parapet) — the shelter tucked into the corner, a slot beside it along the back wall (*slot 2*), and a slot along the sunny left parapet (*slot 1*).
  - **Central Hearth** — the fire pit as the clean focal point.
  - **Cooking & Utility line** (back-right parapet) — a slot on the back-right parapet (*slot 3*) and one snug against the stairwell bulkhead (*slot 4*).
- **🧰 Flexible Predefined Build Slots:** the farm, rainwater barrel, cooking grill and sewing kit aren't tied to a spot — **you choose which goes where**. Each station can be placed once, so once all four are built, no empty slots remain.
  - *(The original layout put the farm in slot 1, the sewing kit in slot 2, the grill in slot 3 and the barrel in slot 4. Older saves keep exactly that.)*
- **Interactive props:**
  - **Central Fire Pit (3 tiers)** — hovering reads *"Light fire pit · 1 🪵"* (or *"Extinguish fire"*). Lighting it (flickering flames, embers, warm glow and a looping campfire crackle) makes the traveler **sit by the fire** and **burns 1 🪵 Timber** of firewood (with too little, a gentle toast says *"Need 1 Timber to light the fire"*). While it's lit, its menu offers **Sit** or **Extinguish** (a soft hiss that saves fuel). A lit fire is also needed for some grill recipes. At Dusk and Night its radial glow warms up the rooftop. It grows with the shelter:
    - **Tier 1 · Makeshift Twigs** (start) — a modest, delicate flame, sparse sparks and a soft compact glow.
    - **Tier 2 · Stacked Logs** — a taller, livelier multi-tongue flame (deep amber outside, bright gold core), steadier rising embers, a ~35% wider and brighter glow pool, and a fuller crackle.
    - **Tier 3 · Stone-Ring Hearth** — a rich hearth fire: layered dancing flames over a pulsing coal bed, frequent drifting embers, curling translucent smoke wisps, a lush wide golden glow that transforms the rooftop at Dusk and Night, and the richest crackle.
  - **Shelter (3 tiers: Cloth Lean-to → Timber Shelter → Insulated Hut) — Context-Aware Rest & Sleep** — tucked into the back-left corner, sheltered by the brick wall:
    - During **Day** or **Dusk**, hovering reads **"Rest by shelter"** — resting (**☕ Rest** in its menu) sits beside the shelter, restores **+25 Stamina**, and smoothly shifts the sky to the next phase over 1.4s.
    - During **Night**, hovering reads **"Sleep until morning"** — sleeping (**🌙 Sleep**) tucks into the bedroll under the shelter in starry twilight, then transitions into **Day N+1 · Morning** with a morning toast. A better shelter means a better night: you wake with at least **75% (T1) → 90% (T2) → 100% (T3) Stamina** (+10% with *Warm Patchwork Sheets*, capped at 100). Strength eases `-10` overnight, or just `-5` in the Insulated Hut. Each new morning the farm is ready to harvest and the rain barrel has refilled.
    - The Timber Shelter's hanging lantern glows at dusk and night; the Insulated Hut glows warmly from its **window and doorway lantern**.
  - **3 searchable box spots, each with distinct art** — broken boxes, a double crate stack, and a single parcel with a leaning plank. Rummage once each (search pose + rummage foley) for Timber, Scrap and Cloth; the broken boxes show a cleared sprite and the others take on a dusty, rummaged look.
  - **6 cleanable weed patches** — 3 weed species (grassy tufts, leafy brush, dandelion clusters), two of each; clearing each (leaf particles + snip foley) yields Seeds and Cloth.
  - **A fresh rooftop every run:** each new game lays the boxes and weeds out differently — new spots, shuffled art, slight size variation (0.92–1.08×) and random flips. They strongly prefer the **rooftop perimeter** (the walls, the front edge, the right foreground and around the front-left brick steps) instead of sitting alone in the middle of the walkway. Boxes settle into corners; weeds scatter along the edges. Nothing ever overlaps a station (at its largest tier), its stand spot, the stairwell path or another prop. The layout is remembered for the whole run (refresh / Continue), and **Start Fresh** rolls a new one. Props in rooftops saved before the stations were recomposed are gently nudged clear of them on load.
  - **🌱 The rooftop renews overnight:** each time you sleep into a new day, **1–2 cleared weed patches sprout back** at brand-new spots (fresh art, size and flip). **Every 2nd day one searched box is replaced by a fresh one** at a new spot by the edge. They use the same collision-safe placement as a fresh layout, so there are never more than 3 boxes and 6 weed patches. The newcomers pop in as morning light fades up, and the morning toast mentions it (*"Day 4 · Morning — Fresh weeds sprouted overnight. …"*). This gives a gentle, steady trickle of Timber, Scrap, Cloth and Seeds.
  - **Stairwell door** — hovering shows a *"Take the lift downstairs"* label; clicking walks the traveler to the door and starts the **ride down to the lobby** (see the onboarding flow above). There is no hover outline on the rooftop door itself — the label is the cue.
- **3-Phase Real-Time Day Cycle & Vitality (`Stamina` & `Strength`):**
  - A full day lasts **12 real-time minutes** (`240s` per phase: **Day** Full Sun → **Dusk** Sunset → **Night** Half Moon), paused whenever you're not on the rooftop (title, lobby, cutscenes), the tab is hidden, or Settings is open. Night holds calmly without harsh pass-outs until the player chooses to sleep.
  - **Stamina (`0–100`, restedness)** is gently spent by clearing weeds (`-6`), searching boxes (`-10`), and building station tiers (`-12`), and restored by resting, sleeping and cooking. *Mended Work Gloves* make weeds and boxes ~30% lighter (`-4` / `-7`); harvesting the farm and collecting rainwater are free.
  - **Strength (`0–100`, nourishment/resilience)** eases gently across phase shifts (`-8`, halved to `-4` with the *Quilted Cozy Cloak*) and overnight (`-10`, or `-5` in the Insulated Hut), non-lethal and zero-stress. Cooking at the grill is the main way to restore it.
  - Displayed in the bottom-left **Vitality Medallion** — a calm, Witcher 3–inspired antique-bronze bezel framing a recessed sky window: a radiant full sun on warm gold by Day, a big sunset sun dipping over a burnt-amber & rose horizon at Dusk, and a luminous half moon over a starry indigo sky at Night. A slim ring inside the bezel tracks the phase and a small **Day N** plaque sits dead-centre on top of the medallion. A slimmer smoked-glass capsule tucks behind the medallion's right half (no square corner peeking out) and holds the **Stamina** (sage-emerald) and **Strength** (hearth-amber) bars with `value/100` readouts. In the scene it's paired with **twinkling night stars**, **drifting warm fireflies**, and brighter fire pit / lantern glow pools at night.
- **Six multi-tier stations, built directly in the scene (no bottom build bar or menu drawers):** Spend found materials straight on the rooftop via **contextual in-world prop menus**:
  - **Empty build slots (`+`)** — hovering reads *"Build here"*. Clicking opens a small menu above the slot listing **every station not yet placed** (🌱 Seedling Crate, 💧 Bucket Barrel, 🍳 Grill Rack, 🧵 Needle & Thread), each with its cost and dimmed if you can't afford it yet. Picking one walks the traveler to the slot, pays the materials and pops that station's first tier into that exact spot.
  - **Built stations** — wherever they were placed — clicking opens a compact frosted pill above the prop (`PropActionMenu`) titled with the station's current name. It holds the station's main action (**☕ Rest** / **🌙 Sleep**, **🔥 Light** with its 🪵 cost or **🔥 Sit** + **Extinguish**, **🌱 Harvest +…** / *Growing — ready tomorrow*, **💧 Collect +…** / *Filling — ready tomorrow*, **🍳 Cook**, **🧵 Mend**). Below it sits **Upgrade to {next tier name}** with the cost, dimmed with a *"Need … more"* hint when short. The menu closes with `Escape` or a click elsewhere.
  - **Maxed stations** with a single action (e.g. the Insulated Hut, Trellis Garden, Guttered Rain Rig, Hearth Kitchen, Sewing Table, or an unlit Stone-Ring Hearth) skip the menu and run their action directly on click.
  - Building walks the traveler over, plays soft mallet foley and a fitting flourish (wood knocks, stone clacks, water chimes, leafy sparkles, a fabric chime), deducts the materials and pops the new tier's art in. Built stations become solid scenery (colliders + Y-sorting).
  - Players see natural tier names (*Timber Shelter*, *Knitting Basket*); the `T1–T5` numbers in the table below are just design shorthand.

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
  - **🌱 Farm harvest** — **Harvest** from the farm's menu (or click it directly once maxed): the traveler walks over and gathers with a soft rustle for **+1 / +2 / +3 🍅 Food** by tier (plus **+1 🌱 Seed** from T2). Then it reads *"Growing — ready tomorrow"* until the next morning.
  - **💧 Rainwater** — **Collect** from the barrel for **+1 / +2 / +3 💧 Water** by tier with a splash chime; it refills each morning (*"Filling — ready tomorrow"*).
  - **🍳 Cooking** — **Cook** at the built grill to open a small frosted **Cooking** popover. Recipes unlock by grill tier; cooking uses the ingredients, restores Stamina & Strength at once (capped at 100), and fills the air with a gentle sizzle, rising steam and floating feedback:

    | Recipe | Grill | Ingredients | Restores |
    |---|---|---|---|
    | 💧 Cool Rainwater | T1 | `1💧` | +10 ⚡ · +5 ❤️ |
    | 🌰 Toasted Seeds | T1 · needs a lit fire | `1🌱` | +15 ❤️ |
    | 🍵 Warm Herbal Tea | T2 · needs a lit fire | `1🍅 1💧` | +30 ⚡ · +10 ❤️ |
    | 🍲 Rooftop Veggie Stew | T3 | `2🍅 1💧` | +15 ⚡ · +45 ❤️ |
    | 🥘 Hearth Spiced Feast | T4 | `2🍅 1🌱 1💧` | +40 ⚡ · +65 ❤️ |

  - **🧵 Mending** — **Mend** at the built sewing kit to open a **Mending** popover of permanent cozy perks (each crafted once, with a soft fabric chime):
    - 🛏️ **Warm Patchwork Sheets** *(T1, `2🧵`)* — +10% Stamina when you sleep.
    - 🧤 **Mended Work Gloves** *(T3, `2🧵 1🔩`)* — clearing weeds & searching boxes costs ~30% less Stamina.
    - 🧥 **Quilted Cozy Cloak** *(T5, `4🧵 1🪵`)* — halves Strength drift as the day turns *(and lays the groundwork for future traveler clothing sprites)*.
  - Popovers explain anything that's missing. Locked rows show 🔒 with the station tier they need by name (*"Needs Grill Counter"*, *"Needs Knitting Basket"*), alongside *"Light the fire pit first"* and *"Need 2 🍅 more"*. They close with `Escape` or a click elsewhere.
- **Found Materials Pouch:** A minimal, centered pouch showing all **7 resources — 🪵 Timber · 🧵 Cloth · 🌱 Seeds · 💧 Water · 🔩 Scrap · 🪨 Stone · 🍅 Food** — compact enough for small windows, each pulsing when it grows and naming itself in a small parchment tooltip on hover or keyboard focus.
- **🧪 Generous test supplies (temporary):** While the stations are being tuned, every freshly claimed shelter starts with a generous pool (`40🪵 15🧵 10🌱 8💧 20🔩 16🪨 6🍅`). Together with the rooftop's boxes and weeds, that's enough to try every station tier, every recipe and every mending perk right away. It's behind a clearly marked `TEST_MODE_GENEROUS_START` switch, and scarcity will be tuned once downstairs scavenging arrives.
- **Persistence:** Fire state, every station's tier, **which station stands in which build slot**, today's farm/barrel readiness, crafted perks, the box & weed layout (including overnight regrowth), searched boxes and cleared weeds are remembered between visits. Older rooftops migrate gently: earlier one-off builds become Tier 2 of their station, stations built before slots were flexible keep their original spots, and props overlapping the recomposed stations are nudged clear. Claiming a new shelter or resetting starts the Terrace fresh with a new layout and four empty slots.

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

- **Time of day:** Morning → Afternoon → Dusk → Night, each with its own lighting on the painted shelter. *(Superseded in play by the live 3-phase Day → Dusk → Night cycle; the 4-step `timeOfDay` is still saved and mapped from the phase for older saves.)*
- **Rest & Sleep:** resting moves to the next phase and restores a little energy; sleeping at night starts the next day fully rested. *(Superseded: resting and sleeping now happen at the rooftop shelter and use Stamina & Strength instead of energy.)*
- **Energy:** building takes effort (15–40 energy); when tired, simply rest. *(Dormant — the live loop uses Stamina.)*
- **10 macro upgrades** across Shell, Dividers, Expansions and Curated Slots. Pitching & patching the canvas tarp is Shell · Tier 1. Each upgrade adds to the **Cozy Index** (0–100) and visibly warms the scene. *(Dormant — the in-scene multi-tier stations don't feed the Cozy Index yet.)*
- **Lantern:** at dusk the old lantern can be lit with the pocket stove — it glows every evening after. *(Dormant; the Timber Shelter and Insulated Hut lanterns glow on their own at dusk and night.)*
- **Milestones:** surviving days and completing upgrades unlock new shelters permanently (kept even when you start a new camp). Days survived **are earned again** now that sleeping advances the day. Upgrade- and expansion-based milestones can't be earned until the macro upgrades return, and every non-Terrace shelter currently shows as locked or "Coming soon" anyway.

### Scavenging, Weather & Valley Relics

- **Surface scavenging (morning & afternoon):** short trips to four nearby spots — the **Overgrown Highway** (scrap, cloth), **Fallen Pine Grove** (timber, seeds), **Crumbling Stone Creek** (stone, water) and **Shattered Greenhouse** (seeds, cloth, scrap). A trip spends energy and one part of the day, always brings something home, and comes back with a small warm story. A cozier shelter (every 25 Cozy Index) means an extra find on each trip.
- **Valley Relics:** now and then a trip turns up a keepsake left by earlier travelers — a *Faded Postcard*, a *Weather Station Log*, a *Cracked Cassette*… Each is tucked into the **Field Journal** to re-read any time.
- **Gentle daily weather:** each morning is *Clear*, *Breezy*, *Soft Rain* (a few cups of free water, more with a rain collector) or, rarely, a *Dust Squall* that keeps you in for the morning. Fortified walls let you brave it. *(Partly live: sleeping into a new day rolls the weather and names it in the morning toast, and Soft Rain adds its free 💧. Squalls have nothing to close while scavenging is paused, and the scene has no weather visuals yet.)*

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
- **Comfort & accessibility:** **Reduce Motion** (Settings) calms camera zoom, elevator shake, particles, fire flicker and UI animations: steady fire glow with no sparks or smoke, still fireflies and stars, no leaf bursts, reward text that fades in place, no prop hover lift, no pouch bounce, calm fades instead of push-ins and door slides in both lift rides, and instant sky/HUD transitions.
- **Backups:** Export / Load Backup saves a single `.json` with the whole run — day, vitality, all 7 materials, milestone stats **and the Terrace rooftop** (every station tier and its build slot, farm/barrel readiness, crafted perks, fire, layout, searched boxes, cleared weeds). Older backups still load: missing Food becomes 0, earlier one-off builds become Tier 2 stations, stations from before flexible slots keep their original spots, and a backup without rooftop details starts the Terrace fresh.
- **Characters:** Understated, faceless 3/4-view travelers in ragged earthy gear, painted to match the backdrops.
- **Audio:** Menu music tries an optional `public/source/audio/music-menu.mp3`; since that file isn't shipped yet, the **procedural warm-pad chord loop** is what currently plays. Procedurally synthesized UI and in-shelter foley (hover, click, claim, locked, footstep, fire ignition + looping campfire crackle that grows fuller with each fire pit tier, fire extinguish hiss, box rummage, weed snip, bedroll sleep, rest chime, building mallet taps, log-stacking knocks, hearth stone clacks, rain-barrel water-drop chimes, farm harvest rustle, grill sizzle & kettle, sewing fabric chime, and the Terrace lift's low hum, door slides, floor-tick relay clicks and brass arrival ding) using Web Audio API — 0 KB. Per-shelter **musical** ambience — soft pitched voices and spaced organic micro-events rather than noise hiss (terrace birdsong & bamboo chimes, pipe drips in a hollow hum, treehouse marimba & creaks, country-house pentatonic chimes, farmhouse barn creaks, cave echo pings, bunker room tone & relay ticks, beachhouse rolling surf, island lapping shore & pine harmonic). Plays on hover, softly while in the shelter, and as a faint birdsong drifting into the ground-floor lobby.

---

## 🗺️ Design Roadmap (Next Up)

- **🔥 Wood-Burning Fire Mechanic (next step):** Lighting the fire already burns 1 Timber; next, a lit campfire should slowly consume more **Timber** over time, turning the extinguish toggle into a meaningful, cozy resource choice (keep warm and bright, or save wood for building).
- **🚪 Beyond-the-Roof Gathering:** The stairwell door already rides the lift down to the ground-floor lobby, whose apartment doors say *"Coming soon"*. Next, open those doors into cozy scavenging rooms with mini-puzzles (see [Downstairs Scavenging & Cozy Mini-Game Puzzles](#downstairs-scavenging--cozy-mini-game-puzzles-planned) below) to gather extra materials (the rooftop itself already renews a little each night). Once that lands, switch off `TEST_MODE_GENEROUS_START` and tune scarcity.
- **📦 More Prop Variety:** A dedicated **lit fire-pit sprite**, plus "cleared" variants for the double crate and single parcel.
- **🛠️ More In-Scene Visual Upgrades:** Beyond the six multi-tier stations — repairing the parapet walls, string lights, and other new **anchor spots**.
- **👕 Traveler Clothing Progression:** Start in ragged earthy traveler gear and unlock cleaner, warmer, cozier outfits as the shelter improves — the *Quilted Cozy Cloak* perk is the first hook for a Tier 2 outfit sprite.
- **🌅 Full Time-of-Day Scenes & More Arrival Vignettes:** Dedicated **Morning / Afternoon / Evening / Night** painted backdrops (and time-specific props) instead of tint-only lighting, plus per-shelter intro vignettes for the other 8 shelters (the Terrace lift ride is the template).
- **🏠 More Interactive Shelters:** Bring the remaining 8 shelters to life with their own scene configs, props, hotspots and buildables.
- **🌱 Richer Rooftop Regrowth:** Build on the nightly weed/box renewal — seasonal sprouts, the odd wind-blown debris pile, or regrowth that slows as the shelter gets tidier.

### Downstairs Scavenging & Cozy Mini-Game Puzzles (Planned)

*Builds on the shipped Ground-Floor Lobby: its **Apartment 1A**, **Apartment 1B** and **side doorway** currently glow and say "Coming soon". These doors become the entrances to the rooms below.*

- **Core concept:** Entering a downstairs apartment opens a calm, illustrated room with a few clickable scavenging spots — a **safe**, a **drawer**, a **cupboard**, **under the bed**, a **shelf** and similar.
- **Interactive mini-games:** Clicking a scavenging spot opens a short, zero-stress puzzle. Solving it unlocks resources (🪵 Timber, 🔩 Scrap (metal scrap), 🧵 Cloth, 🪨 Stone, 🌱 Seeds, 🍅 Food) or, now and then, a **Found Traveler Diary Page** (see the parked scrapbook idea in the backlog). Planned puzzle types:
  1. **Find the Object** — a hidden-object search through a cluttered drawer, cupboard or the space under a bed.
  2. **Jigsaw Puzzle** — piecing together a torn note, a map, or a jammed cover panel.
  3. **Tic-Tac-Toe** — a quick, playful board or latch mini-game.
  4. **Dots & Lines** — *(mechanics to be detailed in a future design pass)*.
  - More puzzle types can be added as new rooms and shelters arrive.
- **The cozy guarantee holds:** mini-games should feel relaxing and rewarding — no punishing timers, no harsh failure states, and always a gentle way to try again or step away.
- **Why it matters:** this is the planned main source of 🪨 Stone and extra materials. It's what lets `TEST_MODE_GENEROUS_START` be switched off and Day 1 scarcity be tuned.

### ✅ Shipped from the roadmap (Terrace v2)

- Rooftop **stairwell/lift entrance** stage with the traveler arriving through its door, and the **shabby cloth lean-to** beside the fire pit as the sleeping spot.
- **Single / double box** sprites and a **third weed species**, so no two gathering spots look alike.
- First **in-scene visual upgrades**: reinforce the cloth lean-to into a timber shelter, a raised herb planter, and a rain barrel.
- **Terrace arrival vignette**: the 3-beat lobby → lift ride → doors-open-to-sunlight elevator cutscene, ending in a calm stroll out of the stairwell.
- **New day rhythm**: the real-time Day → Dusk → Night cycle, with resting and sleeping at the shelter advancing the day and milestone unlocks.
- **3-tier fire pit** (twigs → stacked logs → stone-ring hearth) with fire, glow and crackle that grow each tier.
- **Randomized box & weed layout** per run, hugging the rooftop perimeter.
- **Composed Terrace layout:** three zones against the brick walls — a **Living & Mending nook** on the back-left parapet, the **Central Hearth**, and a **Cooking & Utility line** on the back-right parapet by the stairwell — keeping the middle of the rooftop open.
- **🧰 Flexible Predefined Build Slots:** four curated `+` spots where the player chooses which of the farm, barrel, grill and sewing kit to build (each placed once); older saves keep their original layout.
- **🌱 Rooftop regrowth:** cleared weeds sprout back (1–2 per night) and a searched box is replaced every 2nd day, each at a new spot.
- **Core Vitality & Multi-Tier Progression loop:** 🍅 Food as the 7th resource; six multi-tier stations (Shelter, Fire Pit, Farm, Rainwater Barrel, Cooking Grill, Sewing Kit); daily harvest & rainwater; grill cooking that restores Stamina & Strength; mending perks; shelter-tier sleep comfort; firewood cost to light the fire.
- **In-world station menus:** the bottom build bar replaced by contextual menus above each station (main action + *Upgrade to …*), natural tier names everywhere players look, and pouch tooltips.
- **Ride down to the lobby:** the reverse lift vignette (rooftop → R…1 → lobby) ending in an interactive ground-floor lobby — glowing *"Coming soon"* apartment doors and the lift back up.

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
