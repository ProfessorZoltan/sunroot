# Proposal: heat routes

Status: **prototype built** (Heat Pump and Solar Thermal Collector are in the Willow Reach data and
can be drafted). The other routes below are proposals only.

## Problem

In Milestone 1, heat is not really its own system. Every heat demand is paid with energy, 1 for 1,
in the same slot, and the Heat Well stores it at the same rate. Winter is harder only because homes
need more night power. That leaves a whole season with one kind of answer: build more night power.

## Goal

Give winter its own puzzle: several ways to make heat, each best in a different settlement. The design
pillar for power sources applies here too: **"the choice is about timing and placement, never raw
efficiency."** A route that converts more heat per energy must pay for it in where it can stand,
when it works, or what it takes from another loop. Otherwise every player builds the most
efficient converter and the choice disappears.

## The routes

| Route                       | Rate                                              | The catch                                                                                                                      | Status                               |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Direct heating              | 1 energy → 1 heat                                 | Nothing to build, but it uses power in the same slot.                                                                          | Milestone 1 default                  |
| Heat Well                   | Stores 1 energy as 1 heat, up to 6                | Loses 1 heat a season. Time-shifts heat from day to night, or from autumn to winter.                                           | Milestone 1                          |
| Kiln waste heat             | 1 free heat per kiln run                          | Only into a neighbouring Heat Well.                                                                                            | Milestone 1                          |
| **Heat Pump**               | 1 energy → 2 heat, up to 4 heat per slot          | Must touch the river, a reservoir or a Fish Pond (its heat source). Not flood-tolerant, and river banks are mostly floodplain. | **Built**                            |
| **Solar Thermal Collector** | 2 / 3 / 3 / 2 free heat by day (spring to winter) | Heat only by day, but homes need heat at night, so it needs a Heat Well. Shade costs it 1, as for solar canopies.              | **Built**                            |
| Digester, burn setting      | 2 biomass → 4 heat                                | Instead of 3 energy + 1 compost, so it takes biomass from the compost and kitchen loops.                                       | Proposed                             |
| _Insulation_ tuning         | Cottages need no heat                             | Cuts demand instead of adding supply ("the world gets better, not just bigger").                                               | Proposed (Milestone 6, with tunings) |

Together these make a real winter decision: a heat pump using scarce night power, sun heat banked by
day in a Heat Well, or biomass taken from the compost loop.

## Rules (as built)

Heat demand in each slot is paid in this order:

1. **Free heat** from Solar Thermal Collectors in that slot.
2. **Heat pumps**, in priority order. Each energy through a pump pays 2 heat, in whole units, up to
   4 heat per pump per slot. An odd last heat is paid directly.
3. **Direct heating**: whatever is left costs 1 energy per heat.
4. **Stored heat**: as in Milestone 1, storage discharges only into what is still short.

Free heat left over after step 1 charges Heat Wells (step 6 of the season order, "storage charges
from what is still spare"), before any spare energy does. When a Heat Well reserves day heat for a
night shortfall it can see (DECISIONS.md, C1), it uses spare free heat before spare energy, so the
collector's heat is banked for the night and the day's energy stays free for workshops.

Blackouts work out demand again after each building is shut off, because a heat pump's savings
shrink as the heat demand behind them falls.

Both buildings are energy buildings, so they need no workers (the design's worker rule). My first
sketch gave the heat pump a worker; I dropped that to stay within the rule, and priced it at 7
materials instead.

| Building                | Cost | Workers | Placement                                     | Output                                             |
| ----------------------- | ---- | ------- | --------------------------------------------- | -------------------------------------------------- |
| Heat Pump               | 7    | 0       | Land touching river, reservoir or a Fish Pond | Pays heat at 2 per energy, up to 4 heat per slot   |
| Solar Thermal Collector | 4    | 0       | Any land                                      | 2 / 3 / 3 / 2 heat by day; −1 per slot when shaded |

Neither counts toward the Mixed Grid bonus, which measures energy generation.

## Worked example: a Year 1 winter

The walkthrough's winter needs 4 at night (the Camp's 2 heat, the Cottage's 1 energy and 1 heat)
against 2 supply: a 2 shortfall.

- **River Wheel** (6 materials, the walkthrough's answer): +2 night energy covers it, and +2 day
  energy lets the workshop run twice. The year ends at **12 materials**.
- **Heat Pump** (7): 3 heat becomes 1 pump unit (2 heat for 1 energy) plus 1 direct, so night
  demand falls from 4 to 3. Still 1 short, so the Cottage is blacked out. The year ends at
  **8 materials**. On its own it isn't enough yet.
- **Solar Thermal Collector + Heat Well** (4 + 6 = 10): the collector's 2 winter day heat is banked
  in the well and paid out at night, covering the shortfall without touching day energy, so the
  workshop still runs. It costs exactly what autumn leaves, and the year ends at **5 materials**.
  It also needs two blueprints, and the guided year offers one winter pick.

So in Year 1 the wheel stays the clear answer, which keeps the walkthrough intact. The heat routes
matter later, as the number of cottages grows: 10 cottages need 12 heat a winter night.

## Risks and open questions

- **Heat only matters in winter.** These buildings are idle three seasons out of four, except that
  a collector charges Heat Wells all year (which lose 1 a season). Keep the number of heat
  buildings small.
- **Numbers are first guesses.** Milestone 2's simulator should check whether any route dominates:
  for example, whether collector plus well simply beats a second River Wheel.
- **Should heat be local?** Heat is grid-wide in this prototype, like energy. A local rule (a pump
  only heats buildings within 2 tiles) would add placement depth, but also a new rule to learn.
- **Screen.** The year strip would need a heat layer on each slot so the shortfall's cause is
  visible.
- **Scope.** These add 2 buildings to the design's 23 for Willow Reach. DESIGN.md is unchanged
  until the proposal is accepted.
