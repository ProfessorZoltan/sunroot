/**
 * The season's water (EXPANSION.md, Water system), resolved after staffing
 * and before generation and production, in a fixed order:
 *
 *  1. The spring flood fills lakes and the cisterns it reaches.
 *  2. Lakes, then channels with no intake, serve their users.
 *  3. The river runs from the top of the map down. At each position, water
 *     returned there joins it, a weir releases what it held; then buildings
 *     beside it and channel intakes there draw, in priority order; then a
 *     weir holds back water.
 *  4. Along a channel, from its intake down, buildings draw in order of
 *     distance from the intake, ties by priority. Fresh water is taken from
 *     the source only as it's needed, up to the channel's capacity, and in
 *     summer the first water taken pays evaporation. Cisterns cover what the
 *     channel can't, for buildings at or below them, then refill from what
 *     is left. Water left at the end rejoins the river, or is lost.
 *  5. A cistern beside the river (or a lake) and on no channel keeps water
 *     for the river: whatever draws at or below its position and finds the
 *     river short (a building beside it, a channel's intake) takes from it.
 *     It refills from the river where it stands once the river has served
 *     everything above. Cisterns refill only in the seasons they fill.
 *
 * Every unit is accounted for in the report: `in` equals `out`.
 */
import type { BuildingDef, WaterQuality } from '../content/schema';
import { SEASONS, WATER_QUALITIES } from '../content/schema';
import { hexKey, hexNeighbors } from '../hex';
import { byPriority, defOf, neighborBuildings, tileAt } from '../queries';
import type { BuildingState, ChannelReport, WaterReport, WaterUnits, WaterUse } from '../types';
import {
  channels as findChannels,
  isChannel,
  lakeNear,
  lakeOf,
  lakeTiles,
  riverIndexesNear,
  waterOn,
  type Channel,
} from '../water';
import { explain, type SeasonContext } from './context';

const units = (): WaterUnits => ({ clean: 0, nutrient: 0, grey: 0 });
const total = (u: WaterUnits) => u.clean + u.nutrient + u.grey;

interface Attachment {
  channel: number;
  position: number;
}

export function resolveWater(ctx: SeasonContext): void {
  const { content, state, si } = ctx;
  if (!waterOn(content)) return;
  const rules = content.rules.water;
  const report: WaterReport = {
    riverFlow: rules.riverFlow[si]!,
    flowAt: [],
    channels: [],
    uses: {},
    cleaned: {},
    greyToRiver: 0,
    in: {},
    out: {},
  };
  ctx.report.water = report;
  const add = (rec: Record<string, number>, key: string, n: number) => {
    if (n > 0) rec[key] = (rec[key] ?? 0) + n;
  };

  const order = byPriority(state);
  const rank = new Map(order.map((b, i) => [b.uid, i]));
  const works = (b: BuildingState) => ctx.active.has(b.uid);
  const lakes = lakeTiles(state);
  const ofLake = lakeOf(lakes);
  const lakeWater = (id: string) => lakes.get(id)!.reduce((s, t) => s + (t.water ?? 0), 0);
  const cisterns = order.filter((b) => (defOf(content, b).water?.stores ?? 0) > 0);
  const fillsNow = (b: BuildingState) => defOf(content, b).water!.fills[si]!;
  /** Fills a cistern from `take`, up to its capacity; returns what it took. */
  const refill = (b: BuildingState, take: (n: number) => number): number => {
    const cap = defOf(content, b).water!.stores;
    const gain = fillsNow(b) ? take(cap - (b.stored ?? 0)) : 0;
    b.stored = (b.stored ?? 0) + gain;
    explain(ctx, b, `water: holds ${b.stored} of ${cap}`);
    return gain;
  };
  /** Releases up to `n` from these cisterns, in order; returns what they gave. */
  const release = (from: BuildingState[], n: number): number => {
    let given = 0;
    for (const c of from) {
      const t = Math.min(n - given, c.stored ?? 0);
      c.stored = (c.stored ?? 0) - t;
      given += t;
    }
    return given;
  };
  const weirs = order.filter((b) => defOf(content, b).water?.holdsBack);
  const stored = () =>
    [...cisterns, ...weirs].reduce((s, b) => s + (b.stored ?? 0), 0) +
    [...lakes.keys()].reduce((s, id) => s + lakeWater(id), 0);

  add(report.in, 'stored at the start', stored());
  add(report.in, 'river', report.riverFlow);

  // 1. The spring flood fills lakes, and cisterns on flooded tiles.
  if (ctx.report.event === 'flood') {
    let filled = 0;
    for (const tiles of lakes.values()) {
      for (const t of tiles) {
        const before = t.water ?? 0;
        t.water = Math.max(before, rules.lakePerTile);
        filled += t.water - before;
      }
    }
    const flooded = new Set(ctx.report.flooded);
    for (const c of cisterns) {
      if (!flooded.has(hexKey(c.at))) continue;
      const cap = defOf(content, c).water!.stores;
      filled += cap - (c.stored ?? 0);
      c.stored = cap;
    }
    add(report.in, 'flood', filled);
  }

  const chans = findChannels(content, state, works);
  const channelAt = new Map<string, Attachment>();
  chans.forEach((ch, c) =>
    ch.keys.forEach((key, position) => channelAt.set(key, { channel: c, position })),
  );
  /** The channel a building touches first: lowest channel, then nearest its intake. */
  const attachment = (b: BuildingState): Attachment | null => {
    let best: Attachment | null = null;
    for (const n of hexNeighbors(b.at).map(hexKey)) {
      const a = channelAt.get(n);
      if (
        a &&
        (!best ||
          a.channel < best.channel ||
          (a.channel === best.channel && a.position < best.position))
      )
        best = a;
    }
    return best;
  };

  // Who uses water this season, and where each draws it from.
  type Source =
    | { kind: 'river'; at: number }
    | { kind: 'lake'; id: string }
    | { kind: 'channel'; at: Attachment };
  const users: { b: BuildingState; def: BuildingDef; need: number; source: Source | null }[] = [];
  for (const b of order) {
    const def = defOf(content, b);
    const w = def.water;
    if (!w || !works(b) || isChannel(def)) continue;
    const need = w.needs[si]!;
    const age = state.turn - b.builtTurn;
    if (need === 0 || age < def.maturesAfterSeasons) continue;
    // Buildings that return or clean water work through their channel; others drink from the
    // river (or a lake) when they stand beside it, and from a channel otherwise.
    const onChannel = attachment(b);
    const besideWater = rules.drawBesideRiver;
    const river = besideWater ? riverIndexesNear(state, b.at) : [];
    const lake = besideWater ? lakeNear(state, b.at, ofLake) : null;
    let source: Source | null = null;
    // A building fed by its pond (the Aquaponics Hall) draws on nothing else.
    if (w.fromPond) {
      users.push({ b, def, need, source: null });
      continue;
    }
    const channelFirst = w.returns !== undefined || w.cleans > 0 || !w.accepts.includes('clean');
    if (channelFirst && onChannel) source = { kind: 'channel', at: onChannel };
    else if (river.length > 0) source = { kind: 'river', at: Math.min(...river) };
    else if (lake) source = { kind: 'lake', id: lake };
    else if (onChannel) source = { kind: 'channel', at: onChannel };
    users.push({ b, def, need, source });
  }
  const use = (b: BuildingState, need: number, from: WaterUse['from']): WaterUse => {
    const u: WaterUse = { need, got: units(), from, short: false };
    report.uses[b.uid] = u;
    return u;
  };
  const finish = (u: WaterUse, b: BuildingState) => {
    const got = total(u.got);
    u.short = got < u.need;
    add(report.out, 'used', got);
    const parts = WATER_QUALITIES.filter((q) => u.got[q] > 0).map((q) => `${u.got[q]} ${q}`);
    explain(
      ctx,
      b,
      `water: needs ${u.need}, got ${parts.length > 0 ? parts.join(' + ') : 'none'}` +
        (u.from ? ` from the ${u.from}` : ' (no water nearby)') +
        (u.short ? `: short, × ${rules.shortfallFactor}` : ''),
    );
  };
  // Buildings fed by a neighbouring fish pond: the pond's water goes to them, not its channel.
  const pondFed = new Set<string>();
  for (const { b, def, need } of users.filter((x) => x.def.water!.fromPond)) {
    const u = use(b, need, 'pond');
    for (const p of neighborBuildings(state, b)) {
      const feeds = defOf(content, p).water?.feeds;
      if (!feeds || !works(p) || pondFed.has(p.uid) || total(u.got) >= need) continue;
      if (!def.water!.accepts.includes(feeds.quality)) continue;
      u.got[feeds.quality] += feeds.amount;
      pondFed.add(p.uid);
      add(report.in, 'fed by ponds', feeds.amount);
      explain(
        ctx,
        p,
        `water: feeds ${feeds.amount} ${feeds.quality} to the ${def.name} next to it`,
      );
    }
    finish(u, b);
  }
  for (const { b, def, need, source } of users)
    if (!source && !def.water!.fromPond) finish(use(b, need, null), b);

  // Cisterns on no channel stand by the river (at their most upstream position) or a lake.
  const working = cisterns.filter(works);
  const riverCisterns = working
    .filter((c) => !attachment(c) && riverIndexesNear(state, c.at).length > 0)
    .map((c) => ({ b: c, at: Math.min(...riverIndexesNear(state, c.at)) }));
  const lakeCisterns = working.filter(
    (c) => !attachment(c) && riverIndexesNear(state, c.at).length === 0,
  );
  const lakeCisternsOf = (id: string) =>
    lakeCisterns.filter((c) => lakeNear(state, c.at, ofLake) === id);

  // A building drawing straight from the river or a lake (river water is clean: the river
  // dilutes what reaches it). What it returns goes back where it came from.
  const drinkDirect = (
    entry: (typeof users)[number],
    from: 'river' | 'lake',
    take: (n: number) => number,
    giveBack: (q: WaterQuality, n: number) => void,
  ) => {
    const { b, def, need } = entry;
    const u = use(b, need, from);
    if (def.water!.accepts.includes('clean')) u.got.clean = take(need);
    const ret = def.water!.returns;
    if (ret && total(u.got) >= need) {
      add(report.in, 'returned', ret.amount);
      giveBack(ret.quality, ret.amount);
    }
    finish(u, b);
  };

  // Water on its way back to the river, by river position.
  const pending = new Map<number, WaterUnits>();
  const toRiver = (at: number, q: WaterQuality, n: number) => {
    if (n <= 0) return;
    const p = pending.get(at) ?? units();
    p[q] += n;
    pending.set(at, p);
  };

  // Water rejoining the river at the position being resolved (it joins before the river moves on).
  let rejoiningHere = units();
  const evaporating = rules.evaporation.seasons[si]!;
  const runChannel = (c: number, take: (n: number) => number, here: number | null) => {
    const ch: Channel = chans[c]!;
    const r: ChannelReport = {
      tiles: ch.uids,
      intake: ch.intake,
      drawn: 0,
      evaporated: 0,
      fed: 0,
      released: 0,
      stored: 0,
      rejoined: units(),
      rejoinsAt: ch.rejoinsAt,
      lost: units(),
      carried: [],
      carriedBy: [],
      usedAt: ch.keys.map(() => 0),
    };
    report.channels[c] = r;
    // What enters and leaves the channel at each tile: fresh water enters at the intake.
    const inAt = ch.keys.map(() => 0);
    const outAt = ch.keys.map(() => 0);
    // Nutrient-rich and grey water only come from buildings: what is in the pool past each tile.
    const coloured = ch.keys.map(() => ({ nutrient: 0, grey: 0 }));
    // Panels over a channel (Canal-top Solar) shade the whole of it from evaporation.
    const covered = ch.uids.some(
      (uid) => defOf(content, state.buildings[uid]!).water?.noEvaporation,
    );
    const evaporation =
      evaporating && !covered ? Math.floor(ch.keys.length / rules.evaporation.tilesPerUnit) : 0;
    let room = rules.channelCapacity;
    const fresh = (n: number): number => {
      if (r.evaporated < evaporation) {
        const e = take(Math.min(evaporation - r.evaporated, room));
        r.evaporated += e;
        r.drawn += e;
        room -= e;
        inAt[0]! += e;
        outAt[0]! += e;
        if (r.evaporated < evaporation) return 0;
      }
      const got = take(Math.min(n, room));
      r.drawn += got;
      room -= got;
      inAt[0]! += got;
      return got;
    };
    const pool = units();
    const at = (b: BuildingState) => {
      const a = attachment(b);
      return a && a.channel === c ? a.position : -1;
    };
    const along = (bs: BuildingState[]) =>
      bs
        .map((b) => ({ b, p: at(b) }))
        .filter((x) => x.p >= 0)
        .sort((x, y) => x.p - y.p || rank.get(x.b.uid)! - rank.get(y.b.uid)!);
    const myCisterns = along(cisterns.filter(works));
    const feeders = along(
      order.filter((b) => works(b) && defOf(content, b).water?.feeds && !pondFed.has(b.uid)),
    );
    const cleaners = along(
      order.filter((b) => works(b) && (defOf(content, b).water?.cleans ?? 0) > 0),
    );
    const mine = users
      .filter((x) => x.source?.kind === 'channel' && x.source.at.channel === c)
      .map((x) => ({ ...x, p: (x.source as { at: Attachment }).at.position }))
      .sort((x, y) => x.p - y.p || rank.get(x.b.uid)! - rank.get(y.b.uid)!);

    for (let p = 0; p < ch.keys.length; p++) {
      for (const f of feeders.filter((x) => x.p === p)) {
        const feeds = defOf(content, f.b).water!.feeds!;
        pool[feeds.quality] += feeds.amount;
        r.fed += feeds.amount;
        inAt[p]! += feeds.amount;
        add(report.in, 'fed by ponds', feeds.amount);
        explain(ctx, f.b, `water: feeds ${feeds.amount} ${feeds.quality} into its channel`);
      }
      for (const x of mine.filter((m) => m.p === p)) {
        const w = x.def.water!;
        const u = use(x.b, x.need, 'channel');
        const left = () => x.need - total(u.got);
        for (const q of w.accepts) {
          const t = Math.min(left(), pool[q]);
          pool[q] -= t;
          u.got[q] += t;
          if (q === 'clean' && left() > 0) u.got.clean += fresh(left());
        }
        if (left() > 0 && w.accepts.includes('clean')) {
          // Cisterns at or above this building release what it still needs, nearest first.
          for (const cis of [...myCisterns].reverse()) {
            if (cis.p > p || left() <= 0) continue;
            const t = Math.min(left(), cis.b.stored ?? 0);
            cis.b.stored = (cis.b.stored ?? 0) - t;
            u.got.clean += t;
            r.released += t;
            inAt[cis.p]! += t;
          }
        }
        outAt[p]! += total(u.got);
        r.usedAt[p]! += total(u.got);
        if (w.returns && left() <= 0) {
          pool[w.returns.quality] += w.returns.amount;
          r.fed += w.returns.amount;
          inAt[p]! += w.returns.amount;
          add(report.in, 'returned', w.returns.amount);
        }
        finish(u, x.b);
      }
      for (const x of cleaners.filter((m) => m.p === p)) {
        const t = Math.min(defOf(content, x.b).water!.cleans, pool.grey);
        pool.grey -= t;
        pool.clean += t;
        if (t > 0) report.cleaned[x.b.uid] = (report.cleaned[x.b.uid] ?? 0) + t;
        if (t > 0) explain(ctx, x.b, `water: cleaned ${t} grey water`);
      }
      coloured[p] = { nutrient: pool.nutrient, grey: pool.grey };
    }
    // Cisterns refill, upstream first: from clean water left in the channel, then fresh.
    for (const cis of myCisterns) {
      const gain = refill(cis.b, (n) => {
        const spare = Math.min(n, pool.clean);
        pool.clean -= spare;
        return spare + fresh(n - spare);
      });
      r.stored += gain;
      outAt[cis.p]! += gain;
    }
    let running = 0;
    r.carried = ch.keys.map((_, p) => (running += inAt[p]! - outAt[p]!));
    r.carriedBy = r.carried.map((n, p) => ({
      clean: n - coloured[p]!.nutrient - coloured[p]!.grey,
      ...coloured[p]!,
    }));
    add(report.out, 'evaporated', r.evaporated);
    for (const q of WATER_QUALITIES) {
      if (ch.rejoinsAt !== null) {
        r.rejoined[q] = pool[q];
        if (here !== null && ch.rejoinsAt === here) rejoiningHere[q] += pool[q];
        else toRiver(ch.rejoinsAt, q, pool[q]);
      } else {
        r.lost[q] = pool[q];
        add(report.out, 'lost at channel ends', pool[q]);
      }
    }
  };

  const lakeTake = (id: string) => (n: number) => {
    let got = 0;
    for (const t of lakes.get(id)!) {
      const g = Math.min(n - got, t.water ?? 0);
      t.water = (t.water ?? 0) - g;
      got += g;
    }
    return got;
  };

  // 2. Lakes, then channels that touch no water at their ends.
  for (const id of lakes.keys()) {
    const fromLake = lakeTake(id);
    const take = (n: number) => {
      const t = fromLake(n);
      return t + release(lakeCisternsOf(id), n - t);
    };
    const giveBack = (q: WaterQuality, n: number) => {
      if (q === 'grey') report.greyToRiver += n;
      const first = lakes.get(id)![0]!;
      first.water = (first.water ?? 0) + n;
    };
    const turns = [
      ...users
        .filter((x) => x.source?.kind === 'lake' && x.source.id === id)
        .map((x) => ({ uid: x.b.uid, run: () => drinkDirect(x, 'lake', take, giveBack) })),
      ...chans
        .map((ch, c) => ({ ch, c }))
        .filter(({ ch }) => ch.intake && 'lake' in ch.intake && ch.intake.lake === id)
        .map(({ ch, c }) => ({ uid: ch.uids[0]!, run: () => runChannel(c, take, null) })),
    ].sort((a, b) => rank.get(a.uid)! - rank.get(b.uid)!);
    for (const t of turns) t.run();
    for (const c of lakeCisternsOf(id)) refill(c, fromLake);
  }
  chans.forEach((ch, c) => {
    if (ch.intake === null) runChannel(c, () => 0, null);
  });

  // 3. The river, from the top of the map down.
  const positions = [
    ...new Set(
      Object.values(state.map.tiles)
        .map((t) => t.riverIndex)
        .filter((i): i is number => i !== undefined),
    ),
  ].sort((a, b) => a - b);
  let flow = report.riverFlow;
  // Reed beds on no channel clean grey water where it joins the river beside them.
  const riverReeds = order
    .filter((b) => works(b) && (defOf(content, b).water?.cleans ?? 0) > 0 && !attachment(b))
    .map((b) => ({ b, at: riverIndexesNear(state, b.at), left: defOf(content, b).water!.cleans }))
    .filter((r) => r.at.length > 0);
  const arrive = (u: WaterUnits, at?: number) => {
    for (const r of riverReeds) {
      if (at === undefined || !r.at.includes(at) || u.grey === 0) continue;
      const t = Math.min(r.left, u.grey);
      if (t <= 0) continue;
      r.left -= t;
      report.cleaned[r.b.uid] = (report.cleaned[r.b.uid] ?? 0) + t;
      u.grey -= t;
      u.clean += t;
      explain(ctx, r.b, `water: cleaned ${t} grey water joining the river`);
    }
    report.greyToRiver += u.grey;
    flow += total(u);
  };
  const weirAt = (b: BuildingState) => tileAt(state, b.at)?.riverIndex;
  const season = SEASONS[si];
  for (const i of positions) {
    const back = pending.get(i);
    if (back) arrive(back, i);
    for (const w of weirs) {
      const hold = defOf(content, w).water!.holdsBack!;
      if (weirAt(w) !== i || hold.release !== season) continue;
      flow += w.stored ?? 0;
      if ((w.stored ?? 0) > 0) explain(ctx, w, `water: released ${w.stored} held back`);
      w.stored = 0;
    }
    // Cisterns beside the river at or above here, nearest first, cover what it can't.
    const reserves = riverCisterns
      .filter((c) => c.at <= i)
      .sort((a, b) => b.at - a.at || rank.get(a.b.uid)! - rank.get(b.b.uid)!)
      .map((c) => c.b);
    const fromRiver = (n: number) => {
      const t = Math.min(n, flow);
      flow -= t;
      return t;
    };
    const take = (n: number) => {
      const t = fromRiver(n);
      return t + release(reserves, n - t);
    };
    const giveBack = (q: WaterQuality, n: number) => {
      const u = units();
      u[q] = n;
      arrive(u, i);
    };
    const turns = [
      ...users
        .filter((x) => x.source?.kind === 'river' && x.source.at === i)
        .map((x) => ({ uid: x.b.uid, run: () => drinkDirect(x, 'river', take, giveBack) })),
      ...chans
        .map((ch, c) => ({ ch, c }))
        .filter(({ ch }) => ch.intake && 'river' in ch.intake && ch.intake.river === i)
        .map(({ ch, c }) => ({
          uid: ch.uids[0]!,
          run: () => {
            rejoiningHere = units();
            runChannel(c, take, i);
            arrive(rejoiningHere, i);
          },
        })),
    ].sort((a, b) => rank.get(a.uid)! - rank.get(b.uid)!);
    for (const t of turns) t.run();
    for (const w of weirs) {
      const hold = defOf(content, w).water!.holdsBack!;
      if (weirAt(w) !== i || hold.fill !== season || !works(w)) continue;
      const h = Math.min(hold.amount - (w.stored ?? 0), flow);
      flow -= h;
      w.stored = (w.stored ?? 0) + h;
      if (h > 0) explain(ctx, w, `water: holds back ${h} for ${hold.release}`);
    }
    for (const c of riverCisterns) if (c.at === i) refill(c.b, fromRiver);
    report.flowAt[i] = flow;
  }
  // Water returned below the last position flows out of the valley.
  for (const [i, u] of pending) if (!positions.includes(i)) arrive(u);
  add(report.out, 'flowed downstream', flow);
  add(report.out, 'stored at the end', stored());

  // River wheels turn with the flow beside them.
  for (const b of order) {
    if (!defOf(content, b).water?.wheel) continue;
    const near = riverIndexesNear(state, b.at).map((i) => report.flowAt[i] ?? 0);
    ctx.wheelFlow.set(b.uid, near.length > 0 ? Math.min(...near) : 0);
  }
}
