# Sunroot expansion: water, cascades and new content

Oct 1, 2026 · @Eric

## Summary

This expansion makes water a resource that flows across the map, adds 7 buildings to Willow Reach, and adopts **cascades** as the rule for all new content: every building takes from one cascade (water, heat, shade or waste) and feeds another.

- **Builds on** the [Sunroot design doc](https://claude.ai/code/artifact/a58c9e1d-9178-4884-a5d2-602a0b3b2ebd) and Milestones 0 to 7 as built. Where the two disagree, this doc wins for the systems it covers.
- **Willow Reach v2:** water, plus Irrigation Channel, Cistern, Reed Bed, Bathhouse, Rice-fish Paddy, Mushroom Cellar and Hedgerow. Two existing buildings also become evolution triggers for new forms.
- **Scope limit:** Willow Reach stops at about 30 buildings. Everything else listed here is reserved for the biome it suits, so each region plays differently.
- **Order:** prototype water in the simulator first, with no new screens. Only build the content and interface if the summer water choices prove interesting.
- **Replaces** the current rule that farms more than 2 tiles from water lose half their summer yield.

All numbers are first-pass starting values for the balance simulator to test.

## Water system

Water flows from the river through channels the player lays, and buildings along a channel take water upstream first. The core tension: every unit sent to fields is a unit that doesn't turn the river wheels downstream.

**River flow** (units entering at the top of the map each season)

| Season | Spring | Summer | Autumn | Winter |
| --- | --- | --- | --- | --- |
| River flow | 12 | 4 | 8 | 6 |

**Flow rules**

1. **River:** flow moves down the river tile by tile. Each channel intake takes its water at the river tile where the channel starts, so upstream intakes draw first.
2. **Channels:** an Irrigation Channel is a path of tiles starting next to the river. A channel carries at most 4 water per season. Channels can't be built on hills.
3. **Order along a channel:** buildings next to a channel tile draw in order of distance from the intake. Ties use a player-set priority, like blackout priority.
4. **Return flow:** buildings that output water put it back into the channel at their position, where buildings further down can use it. Water left at the end of a channel rejoins the river if the channel touches it again; otherwise it is lost.
5. **Summer evaporation:** each channel loses 1 water in summer for every 4 channel tiles, rounded down.
6. **Shortfall:** a building that gets less water than it needs produces half its output that season, rounded down.
7. **River wheels:** if a wheel's river tile carries less than half of that season's river flow, the wheel makes 1 less energy per slot.

**Water qualities.** Every unit is tagged with a quality and each building lists what it accepts.

| Quality | Comes from | Accepted by | If it reaches the river |
| --- | --- | --- | --- |
| Clean | River, cistern, reed bed | Everything that uses water | No effect |
| Nutrient-rich | Fish pond, rice-fish paddy | Farm (+1 food), greenhouse, orchard | No effect |
| Grey | Bathhouse | Reed bed only | −1 Harmony per unit that season |

**Who uses water** (per season)

| Building | Water | Notes |
| --- | --- | --- |
| Floodplain Farm | 1 in spring, summer and autumn | Clean or nutrient-rich; nutrient-rich gives +1 food |
| Orchard | 1 in summer | Clean or nutrient-rich |
| Greenhouse | 1 every season | Clean or nutrient-rich |
| Rice-fish Paddy | 2 in spring, summer and autumn | Outputs 1 nutrient-rich |
| Bathhouse | 1 clean every season | Outputs 1 grey |
| Fish Pond | Draws from the river, not a channel | Outputs 1 nutrient-rich into a neighboring channel |
| Homes, energy, industry | None | Keeps bookkeeping light |

**Storage and control**

- **Cistern:** stores up to 6 water from its channel's surplus and releases it when the channel runs short. Fill it in spring, spend it in summer.
- **Weir (changed):** holds back 4 water from spring's flow and releases it below the weir in summer. Its flood and reservoir effects are unchanged.
- **Pump Station** (Highland): uses spare energy, 2 energy lifts 2 water one hill tile up.

**Teaching.** Irrigation Channel is unlocked from the start, and the Founders' Camp begins with a 3-tile channel already dug. Grey water first appears when the player drafts a Bathhouse, which is when its tooltip explains reed beds.

**On screen:** channels are drawn as blue lines with small flowing marks, thinner as water is used up. Each tile's tooltip shows water in, used and out, by quality.

## Cascades

The rule for all new content: **every new building takes from one cascade and feeds another.** This keeps new buildings connected to the existing economy instead of standing alone, and every connection is a potential combo.

| Cascade | Direction | Example |
| --- | --- | --- |
| Water | Downstream along a channel; quality changes as it is used | Bathhouse → reed bed → paddy → farm |
| Heat | From hot to warm, losing 1 at each step | Kiln → bathhouse → greenhouse |
| Shade | From tall buildings to their neighbors; a penalty for solar, a benefit for some buildings | Tall building → mushroom cellar |
| Waste | Existing loops | Scraps → compost; clutter → materials |

&#91;embedded content: A water and heat cascade along one channel in Willow Reach v2\]

Water and heat meet at the bathhouse; the river wheel downstream is where taking more water costs power.

## New buildings

Willow Reach v2 adds 7 buildings, taking the biome to 30. Irrigation Channel is unlocked from the start; the other 6 join the draft.

**Willow Reach v2**

| Building | Cost | Workers | Placement | What it does |
| --- | --- | --- | --- | --- |
| Irrigation Channel | 1 per tile | 0 | Path starting next to the river; not on hills | Carries up to 4 water per season (see Water system) |
| Cistern | 5 | 0 | Next to a channel | Stores up to 6 water from surplus; releases it when the channel runs short |
| Reed Bed | 3 | 0 | Next to a channel or the river | Turns up to 3 grey water clean and returns it; 1 biomass in spring to autumn; +1 Harmony; flood-tolerant |
| Bathhouse | 8 | 1 | Next to a channel | 1 clean water + 1 heat → +3 wellbeing; outputs 1 grey. Takes heat from a neighboring heat well or kiln first, otherwise 1 night energy |
| Rice-fish Paddy | 5 | 1 | Floodplain, next to a channel | Needs 2 water in spring to autumn. Food 2 / 4 / 4 / 0; gets the silt bonus; outputs 1 nutrient-rich; flood-tolerant |
| Mushroom Cellar | 5 | 1 | Anywhere | 2 biomass → 2 food + 1 compost every season, winter included; +1 food when shaded by a tall building or next to woodland |
| Hedgerow | 1 per tile | 0 | Any land | Counts as meadow for Harmony and the Wildway; buildings next to it can't be storm-damaged |

**Changes to existing buildings**

- **Weir:** holds back 4 spring water and releases it in summer (see Water system).
- **Floodplain Farm, Orchard, Greenhouse:** now use water (see Water system). The "2 tiles from water" rule is removed.

**Reserved for Root City district unlocks** (added to the draft pool by a Graft, not in the base Willow Reach pool)

| Building | What it does | Unlocked by |
| --- | --- | --- |
| Repair Café | 2 clutter → 1 material + 1 wellbeing | Foundry District |
| Preserve House | Stores 10 food that never rots, so autumn surplus carries into winter | Orchard Ward |

**Reserved for later biomes** (numbers set when each biome is designed)

| Building | What it does | Biome |
| --- | --- | --- |
| Pump Station | Spare energy: 2 energy lifts 2 water one hill tile up | Highland |
| Biochar Kiln | Biomass → energy + biochar; biochar permanently improves a tile and gives its farm +1 food | Highland |
| Thermal Collector | Turns daytime sun directly into heat for a heat well | Sun Desert |
| Fog Net | Collects 1 clean water per night with no river | Sun Desert |
| Desalinator | Spare energy turns seawater into clean water | Windswept Coast |

## New evolutions

Seven evolutions use only Willow Reach v2 buildings. The new idea is **branching**: when a building meets the triggers for two evolutions, the player chooses which one it becomes, so evolutions become a decision as well as a discovery.

**Rules**

- Evolutions happen automatically during the discovery step, as now.
- If two evolutions trigger for the same building, the player picks one before the next season starts.
- Coppicing is the exception: it is a player action, so Harmony is never lost without the player choosing it.

| From | Trigger | Becomes | Effect |
| --- | --- | --- | --- |
| Orchard | An apiary and 2 meadow tiles next to it | Food Forest | Food 1 / 2 / 4 / 1 (winter included); no worker needed; +2 Harmony; still uses 1 water in summer |
| Greenhouse | Next to a fish pond | Aquaponics Hall | 4 food every season; uses the pond's nutrient-rich output instead of channel water; still needs 2 day energy |
| Solar Canopy | Built on a channel tile | Canal-top Solar | That channel loses no water to summer evaporation; +1 day energy in summer; water still flows under it |
| Weir | Harmony 50 or more and woodland next to it | Beaver Dam | +2 Harmony; each year a reed bed appears on a free tile beside the reservoir, up to 3; flood and water effects unchanged |
| Wind Spire | Pollinator meadows on 2 sides | Singing Spire | No Harmony penalty; +1 wellbeing per season |
| Empty salvage yard | No library next to it | Rewilded Ruin (existing) | +2 Harmony |
| Empty salvage yard | Library next to it | Old World Archive | +2 Knowledge per season; 1 worker. Branches with Rewilded Ruin |
| Woodland tile | Player chooses to coppice it; workshop next to it | Coppice Wood | 2 materials per season; counts as meadow for Harmony (1 instead of 2). Stop coppicing and it returns to woodland after 2 seasons |

## New chains and formations

Three new chains and four new formations use only Willow Reach v2 content. Chains keep the existing reward: +1 output on each building in a closed loop.

**Chains**

| Chain | Loop | Closes when |
| --- | --- | --- |
| Bath Loop | Kiln or heat well → heat → bathhouse → grey water → reed bed → clean water → a building further down the same channel | The bathhouse takes its heat from a neighbor, and the reed bed's clean water is used downstream |
| Rice-Fish Loop | Channel → rice-fish paddy → nutrient-rich water → farm downstream → biomass → composter → compost → paddy | The composter is next to the paddy and fed by that farm's biomass |
| Mushroom Loop | Farm → biomass → mushroom cellar → spent substrate (compost) → farm | The cellar is next to the farm it feeds and the farm it composts |

The Mushroom Cellar's compost output, listed under New buildings, is what lets this loop close.

**Formations**

| Formation | Shape | Effect |
| --- | --- | --- |
| Keyhole Garden | A composter with 3 farms next to it | Its compost output doubles |
| Water Ladder | 3 rice-fish paddies in a row along one channel | Each passes its nutrient-rich output to the next without loss; +1 food each |
| Windbreak | 4 hedgerows in an unbroken line | Storms can't damage any building within 2 tiles on the east side |
| Hearth Square | A bathhouse, a Commons Plaza and a cottage all touching each other | +5 wellbeing in winter |

**Later, with reserved buildings:** a *Carbon Loop* (coppice → biomass → biochar kiln → energy and biochar → farms) for the Highland, and a *Repair Loop* (homes → clutter → Repair Café → materials) once the Foundry District unlocks the café.

## Bigger systems

Three larger systems are worth building after water: wildlife, biome wonders and festivals. Each makes progress more visible or gives surplus a purpose. The rest are deferred or skipped.

**Wildlife (do after water).** Animals arrive as Harmony rises, live on habitat tiles and have small effects. They are the clearest sign a valley is healing, and their effects stack with combos in unplanned ways.

| Animal | Arrives at | Lives on | Effect |
| --- | --- | --- | --- |
| Wild bees | Harmony 20 | Meadow tiles | Farms next to 2 or more meadow tiles +1 food in summer |
| Otters | Harmony 40 | River tiles next to a reed bed | Fish ponds and paddies within 2 tiles +1 food |
| Beavers | Harmony 50, woodland by the weir | The weir | Triggers the Beaver Dam evolution |
| Deer | Harmony 70 | Woodland groups of 4 or more | +1 wellbeing per season for each herd |

Animals move between their habitat tiles for show, but their effects depend only on habitat, so the simulation stays deterministic.

**Biome wonder (do after water).** One large multi-tile project per biome as the late-run goal. Willow Reach's is the **Great Water Garden**: a 7-hex flower shape built over 4 seasons, which requires a closed Bath Loop and 3 reed beds. Completing it adds a large score bonus and raises the Graft one tier. It can also serve as the Bloom era goal.

**Festivals (cheap, do anytime).** Optional, once a year each, chosen at the end of a season. They give surplus a fun use.

| Festival | Season | Cost | Reward |
| --- | --- | --- | --- |
| Flood Fair | Spring | 5 materials | +3 wellbeing; the flood's silt reaches 1 extra tile ring |
| Harvest Festival | Autumn | 10 food | +5 wellbeing and one free draft reroll |
| Lantern Night | Winter | 5 materials, every night slot powered | +3 wellbeing; wildlife appears on screen |

**Deferred**

- **Contaminated land:** ruins pollute nearby tiles; sunflower fields or mycelium beds clean them. Better as a Tempest twist or a later biome.
- **Gift trade:** passing airships offer swaps, and gifts build reputation that unlocks rare cards. Revisit after Root City exists.

**Skipped for now**

- **Soil health and crop rotation:** another hidden per-tile layer, and water already adds one.
- **Worker specialties:** adds micromanagement for little payoff.

## Build plan for Claude Code

Build water in the simulator first and stop at a decision gate before any screens or content. Run E1 to E3 before Milestone 8 (Root City), because Grafts read a run's playstyle and water changes what those runs look like.

**Milestones**

1. **E1. Water in the simulation (headless).** All flow rules, channels, water qualities, cistern, the weir change, the river-wheel effect and shortfalls. Farms, orchards and greenhouses use water; the Camp starts with a 3-tile channel. Bots learn to lay channels.
   - *Done when:* each flow rule has a unit test; a new Year 1 golden test replaces the old one (Claude Code proposes the walkthrough, records it in DECISIONS.md, and it is reviewed before it becomes the reference); the simulator report compares v1 and v2.
   - *Decision gate:* the report must show summer water is a real choice. If summer has no shortfall in most runs, or one channel layout wins almost every time, stop and tune the numbers before E2.
2. **E2. Water on screen.** A channel-laying tool, blue flowing lines that thin as water is used, tile tooltips showing water in, used and out by quality, and a priority setting for ties.
   - *Done when:* a player can see where every unit of water went in any season.
3. **E3. Willow Reach v2 content.** The 6 new draft buildings, the 7 evolutions with the branching choice, the coppice action, 3 chains, 4 formations and their Almanac entries.
   - *Done when:* every new combo triggers in a unit test and reveals with its card; in the simulator, no single new card appears in more than 40% of winning bot runs.
4. **E4. Wildlife and festivals.** Four animals with habitat effects and on-screen movement; three festivals.
   - *Done when:* animals appear at their Harmony thresholds and their effects match this doc in unit tests.
5. **E5. Great Water Garden.** The Willow Reach wonder as the late-run goal.
   - *Done when:* it can be completed in a full run and its score and Graft effects apply.

Reserved buildings arrive later with their Root City districts and biomes.

**Working rules** (in addition to those in the main design doc)

- Water rules, flows and qualities live in data files, like all other content.
- Keep the simulation deterministic: water is resolved in a fixed order, upstream first, ties by player priority.
- Use bots that only see what a player sees (the forecast) for the E1 decision gate; add that bot mode first if it doesn't exist yet.
- Record every rule this doc leaves open in DECISIONS.md.

**Kickoff prompt** (export this doc as Markdown to `docs/EXPANSION.md` first)

```text
Read docs/DESIGN.md, then docs/EXPANSION.md. EXPANSION.md adds water, cascades
and new Willow Reach content, and wins where the two docs disagree.
Build milestone E1 only: water in the headless simulation, with unit tests for
every flow rule. Propose a new Year 1 walkthrough with water as the golden test
and record it in docs/DECISIONS.md, but don't treat it as the reference until I
review it. Then run the simulator comparing v1 and v2 and report against the E1
decision gate. Stop after E1 and summarize what you built, what you decided,
what the report shows, and what you would change in the water design.
```

## Open questions and risks

The main risk is that water adds bookkeeping without adding real choices; the E1 decision gate exists to catch that before any screens are built.

**Open questions**

- [ ] Is a summer river flow of 4 too harsh, or too easy once cisterns and the weir are built?
- [ ] Does the spring flood fill cisterns inside the flooded area for free?
- [ ] Should a Pump Station come to Willow Reach so channels can reach hills, or stay a Highland building?
- [ ] Can the player decline both branches of an evolution and keep the original building?
- [ ] With 30 buildings, does the draft show new players too much? Consider holding water buildings back until run 2.
- [ ] Numbers for the Great Water Garden and festivals after E1 to E3 are tuned.

**Risks and mitigations**

| Risk | Mitigation |
| --- | --- |
| Water feels like chores rather than choices | E1 decision gate; homes don't use water; fallback is to drop to two qualities, clean and used |
| One channel layout beats all others | Rivers differ by map seed; tune the per-channel cap of 4 and summer evaporation |
| Golden test churn | New reference walkthrough is reviewed by a person before it becomes the standard |
| Too much content for one biome | Willow Reach stops at 30 buildings; extras go to districts and later biomes |
| Wildlife makes Harmony snowball | Keep animal effects to +1; check late-run Harmony in the simulator |
