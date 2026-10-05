/**
 * The only way to change a run: the client sends commands and draws the state
 * that comes back. Every command is pure: the input state is never mutated.
 */
import type { Content } from './content/load';
import { AUTO_RECIPE, type Resource } from './content/schema';
import { compostPlan } from './compost';
import { burnClear, feedSoil, layerProblem } from './forest';
import { demolish, demolishCheck } from './demolish';
import { projectBlocked } from './projects';
import { drawCards, draftSize, isTuning } from './draft';
import { hexKey } from './hex';
import { canPlace } from './placement';
import { edgeBuilding, edgeKey, hedgeProblem } from './edges';
import { coppiceCombo, coppiceProblem, evolve, hintable, placementEvolution } from './combos';
import { effectiveContent } from './content/modifiers';
import {
  buildingAt,
  computeHarmony,
  defOf,
  improveTile,
  plantTile,
  isHome,
  repairCost,
  tileAt,
} from './queries';
import { flow } from './season/context';
import { festivalProblem, festivalThisSeason } from './wildlife';
import { wonderExtraCost } from './wonder';
import { resolveSeason } from './season/resolve';
import { cloneState, snapshot } from './snapshot';
import type { Command, CommandResult, RunState } from './types';

const fail = (error: string): CommandResult => ({ ok: false, error });

export function applyCommand(base: Content, state: RunState, command: Command): CommandResult {
  if (state.status !== 'active') return fail('the run has ended');
  if (command.type === 'undo') return undo(base, state);
  if (command.type === 'endSeason') {
    if (state.draft.offer.length > 0 && state.draft.picked === null) {
      return fail('pick a draft card before ending the season');
    }
    if (state.charterOffer.length > 0) return fail('choose a charter before ending the season');
    if (state.visionOffer.length > 0) return fail('choose a vision before ending the season');
    const branch = state.evolutionOffer[0];
    if (branch) {
      const def = effectiveContent(base, state).byId[state.buildings[branch.uid]?.type ?? ''];
      return fail(`choose what the ${def?.name ?? 'building'} becomes before ending the season`);
    }
    return { ok: true, state: resolveSeason(base, state) };
  }
  const content = effectiveContent(base, state);
  const next = cloneState(state);
  const error = mutate(content, next, command);
  if (error) return fail(error);
  next.seasonCommands.push(command);
  next.harmony = computeHarmony(content, next);
  return { ok: true, state: next };
}

/** Applies a build-phase command in place; returns an error message or null. */
function mutate(content: Content, s: RunState, command: Command): string | null {
  const k = content.rules.knowledge;
  switch (command.type) {
    case 'pickCard': {
      if (s.draft.picked !== null) return 'already picked a card this season';
      if (!s.draft.offer.includes(command.card)) return `${command.card} is not on offer`;
      s.draft.picked = command.card;
      if (isTuning(content, command.card)) s.tunings.push(command.card);
      else if (!s.unlocked.includes(command.card)) s.unlocked.push(command.card);
      return null;
    }
    case 'pickCharter': {
      if (!s.charterOffer.includes(command.charter)) return `${command.charter} is not on offer`;
      s.charters.push(command.charter);
      s.charterOffer = [];
      return null;
    }
    case 'pickVision': {
      if (!s.visionOffer.includes(command.vision)) return `${command.vision} is not on offer`;
      s.vision = command.vision;
      s.visionOffer = [];
      return null;
    }
    case 'chooseEvolution': {
      const offer = s.evolutionOffer.find((o) => o.uid === command.uid);
      if (!offer) return 'that building has no evolution to choose';
      if (!offer.options.includes(command.combo))
        return `${command.combo} is not one of its evolutions`;
      s.evolutionOffer = s.evolutionOffer.filter((o) => o !== offer);
      const combo = content.comboById[command.combo]!;
      const b = s.buildings[command.uid];
      if (b && combo.layer === 'evolution' && b.type === combo.from) evolve(s, b, combo.into);
      return null;
    }
    case 'coppice': {
      const problem = coppiceProblem(content, s, command.at);
      if (problem) return problem;
      const combo = coppiceCombo(content)!;
      const uid = `b${s.nextUid++}`;
      s.buildings[uid] = {
        uid,
        type: combo.into,
        at: { q: command.at.q, r: command.at.r },
        builtTurn: s.turn,
        evolvedFrom: combo.from,
        evolvedTurn: s.turn,
      };
      s.priority.push(uid);
      return null;
    }
    case 'stopCoppice': {
      const b = s.buildings[command.uid];
      const combo = coppiceCombo(content);
      if (!b || !combo || combo.when.kind !== 'coppiced' || b.type !== combo.into)
        return 'only a coppice can stop being coppiced';
      // It grows back: woodland again after the regrowth's seasons.
      b.type = combo.when.regrowth;
      b.builtTurn = s.turn;
      return null;
    }
    case 'addLayer': {
      const problem = layerProblem(content, s, command.uid, command.layer);
      if (problem) return problem;
      const b = s.buildings[command.uid]!;
      const def = defOf(content, b);
      const layer = def.layers!.find((l) => l.id === command.layer)!;
      s.stores.materials -= layer.cost;
      flow(
        s.spent,
        'materials',
        'used',
        `Building: ${def.name} (${layer.name.toLowerCase()})`,
        layer.cost,
      );
      b.layers = [...(b.layers ?? []), { id: layer.id, turn: s.turn }];
      return null;
    }
    case 'plantHedge': {
      const problem = hedgeProblem(content, s, command.a, command.b);
      if (problem) return problem;
      const def = edgeBuilding(content)!;
      if (!s.unlocked.includes(def.id)) return `${def.name} is not unlocked`;
      if (s.stores.materials < def.cost) return `${def.name} costs ${def.cost} materials`;
      s.stores.materials -= def.cost;
      flow(s.spent, 'materials', 'used', `Building: ${def.name}`, def.cost);
      s.hedges = [...s.hedges, edgeKey(command.a, command.b)].sort();
      return null;
    }
    case 'removeHedge': {
      const key = edgeKey(command.a, command.b);
      if (!s.hedges.includes(key)) return 'there is no hedge there';
      s.hedges = s.hedges.filter((e) => e !== key);
      return null;
    }
    case 'buyHint': {
      const reason = hintable(content, s, command.combo);
      if (reason) return reason;
      if (s.stores.knowledge < k.hint) return `a hint needs ${k.hint} knowledge`;
      s.stores.knowledge -= k.hint;
      flow(s.spent, 'knowledge', 'used', 'Almanac hints', k.hint);
      s.hints.push(command.combo);
      return null;
    }
    case 'rerollDraft': {
      if (s.draft.picked !== null) return 'already picked a card this season';
      // A reroll a festival gave is used first.
      if (s.freeRerolls > 0) s.freeRerolls -= 1;
      else {
        if (s.stores.knowledge < k.reroll) return `rerolling needs ${k.reroll} knowledge`;
        s.stores.knowledge -= k.reroll;
        flow(s.spent, 'knowledge', 'used', 'Rerolling the draft', k.reroll);
      }
      const count = draftSize(content, s) + (s.draft.extraBought ? 1 : 0);
      s.draft.offer = drawCards(content, s, count);
      return null;
    }
    case 'buyExtraCard': {
      if (s.draft.picked !== null) return 'already picked a card this season';
      if (s.draft.extraBought) return 'already bought an extra card this season';
      if (s.stores.knowledge < k.extraCard) return `an extra card needs ${k.extraCard} knowledge`;
      const [card] = drawCards(content, s, 1, s.draft.offer);
      if (!card) return 'no more blueprints to draw';
      s.stores.knowledge -= k.extraCard;
      flow(s.spent, 'knowledge', 'used', 'A 4th draft card', k.extraCard);
      s.draft.offer.push(card);
      s.draft.extraBought = true;
      return null;
    }
    case 'place': {
      const def = content.byId[command.building];
      if (!def) return `unknown building ${command.building}`;
      if (!s.unlocked.includes(def.id)) return `${def.name} is not unlocked`;
      const site = canPlace(content, s, def.id, command.at);
      if (!site.ok) return site.reason;
      if (s.stores.materials < def.cost) return `${def.name} costs ${def.cost} materials`;
      for (const [res, n] of wonderExtraCost(def))
        if (s.stores[res] < n) return `${def.name} costs ${n} ${res} as well`;
      s.stores.materials -= def.cost;
      flow(s.spent, 'materials', 'used', `Building: ${def.name}`, def.cost);
      for (const [res, n] of wonderExtraCost(def)) {
        s.stores[res] -= n;
        flow(s.spent, res, 'used', `Building: ${def.name}`, n);
      }
      // A canopy built over a farm becomes part of it (an evolution).
      const target = buildingAt(s, command.at);
      const evolution = placementEvolution(content, def.id, target);
      if (target && evolution) {
        evolve(s, target, evolution.into);
        return null;
      }
      const uid = `b${s.nextUid++}`;
      s.buildings[uid] = {
        uid,
        type: def.id,
        at: { q: command.at.q, r: command.at.r },
        builtTurn: s.turn,
      };
      const b = s.buildings[uid]!;
      // A wonder covers the 6 tiles around its own.
      if (def.wonder) b.footprint = 1;
      if (def.recipes) b.recipe = def.recipes.defaultRecipe;
      if (def.digester) b.slot = def.digester.defaultSlot;
      if (def.storage) b.stored = 0;
      if (def.setsTile) plantTile(content, tileAt(s, b.at)!, def.setsTile);
      if (def.burns) burnClear(content, tileAt(s, b.at)!, def.burns);
      if (def.weir) {
        const index = tileAt(s, b.at)!.riverIndex ?? 0;
        const occupied = new Set(Object.values(s.buildings).map((o) => hexKey(o.at)));
        for (const key of s.map.river) {
          const t = s.map.tiles[key]!;
          const i = t.riverIndex ?? 0;
          if (
            t.type === 'river' &&
            i < index &&
            i >= index - def.weir.reservoirTiles &&
            !occupied.has(key)
          ) {
            t.type = 'reservoir';
          }
        }
      }
      // Default priority: homes stay on longest, then buildings in the order they were built.
      if (isHome(def)) {
        const lastHome = s.priority.findLastIndex((u) => isHome(defOf(content, s.buildings[u]!)));
        s.priority.splice(lastHome + 1, 0, uid);
      } else {
        s.priority.push(uid);
      }
      return null;
    }
    case 'startProject': {
      const blocked = projectBlocked(content, s, command.project);
      if (blocked) return blocked;
      const p = content.projects.find((x) => x.id === command.project)!;
      for (const [res, n] of Object.entries(p.cost) as [Resource, number][]) {
        s.stores[res] -= n;
        flow(s.spent, res, 'used', `Project: ${p.name}`, n);
      }
      s.projects = [...s.projects, { id: p.id, started: s.turn, done: null }];
      return null;
    }
    case 'holdFestival': {
      const problem = festivalProblem(content, s, command.festival);
      if (problem) return problem;
      const f = content.festivals.find((x) => x.id === command.festival)!;
      for (const [res, n] of Object.entries(f.cost) as [Resource, number][]) {
        s.stores[res] -= n;
        flow(s.spent, res, 'used', `Festival: ${f.name}`, n);
      }
      s.festivals = { ...s.festivals, [f.id]: s.year };
      return null;
    }
    case 'cancelFestival': {
      const f = festivalThisSeason(content, s);
      if (!f || f.id !== command.festival) return 'that festival is not being held this season';
      for (const [res, n] of Object.entries(f.cost) as [Resource, number][]) {
        s.stores[res] += n;
        const used = s.spent[res]?.used;
        if (used) delete used[`Festival: ${f.name}`];
      }
      const rest = { ...s.festivals };
      delete rest[f.id];
      s.festivals = rest;
      return null;
    }
    case 'demolish': {
      const check = demolishCheck(content, s, command.uid);
      const err = demolish(content, s, command.uid);
      if (err) return err;
      s.evolutionOffer = s.evolutionOffer.filter((o) => o.uid !== command.uid);
      flow(s.spent, check.into, 'made', 'Demolition rubble', check.rubble);
      return null;
    }
    case 'spreadCompost': {
      const tile = tileAt(s, command.at);
      if (!tile) return 'outside the valley';
      const cost = content.rules.compostPerTileStep;
      if (s.stores.compost < cost) return `spreading compost needs ${cost} compost`;
      // On a field (Rainforest Gardens) it feeds the soil as well as healing the land.
      const fed = feedSoil(content, s, tile);
      if (!improveTile(content, tile, 1) && !fed) return `compost can't improve ${tile.type}`;
      s.stores.compost -= cost;
      flow(s.spent, 'compost', 'used', 'Spread on the land', cost);
      return null;
    }
    case 'autoCompost': {
      const cost = content.rules.compostPerTileStep;
      if (!Number.isInteger(command.times) || command.times < 1)
        return 'spread compost at least once';
      const times = Math.min(command.times, Math.floor(s.stores.compost / cost));
      if (times < 1) return `spreading compost needs ${cost} compost`;
      const plan = compostPlan(content, s, times);
      if (plan.length === 0) return 'no land left that compost can improve';
      for (const key of plan) {
        feedSoil(content, s, s.map.tiles[key]!);
        improveTile(content, s.map.tiles[key]!, 1);
        s.stores.compost -= cost;
        flow(s.spent, 'compost', 'used', 'Spread on the land', cost);
      }
      return null;
    }
    case 'setRecipe': {
      const b = s.buildings[command.uid];
      const recipes = b && defOf(content, b).recipes;
      if (!b || !recipes) return 'that building has no recipes';
      const auto = command.recipe === AUTO_RECIPE && recipes.options.length > 1;
      if (!auto && !recipes.options.some((o) => o.id === command.recipe))
        return `unknown recipe ${command.recipe}`;
      b.recipe = command.recipe;
      return null;
    }
    case 'setDigesterSlot': {
      const b = s.buildings[command.uid];
      if (!b || !defOf(content, b).digester) return 'that building is not a digester';
      b.slot = command.slot;
      return null;
    }
    case 'setPriority': {
      const current = new Set(s.priority);
      const given = new Set(command.order);
      if (given.size !== command.order.length || given.size !== current.size) {
        return 'priority must list every building once';
      }
      for (const uid of command.order) if (!current.has(uid)) return `unknown building ${uid}`;
      s.priority = [...command.order];
      return null;
    }
    case 'setAutoRepair': {
      const b = s.buildings[command.uid];
      if (!b) return `unknown building ${command.uid}`;
      if (command.auto) delete b.holdRepairs;
      else b.holdRepairs = true;
      return null;
    }
    case 'repair': {
      const b = s.buildings[command.uid];
      if (!b) return `unknown building ${command.uid}`;
      const cost = repairCost(content, b);
      if (cost === null) return `the ${defOf(content, b).name} needs no repair`;
      if (s.stores.materials < cost) return `repairing it needs ${cost} materials`;
      s.stores.materials -= cost;
      const cause = b.damage!.cause;
      flow(
        s.spent,
        'materials',
        'used',
        cause === 'flood' ? 'Flood repairs' : 'Storm repairs',
        cost,
        b.uid,
      );
      delete b.damage;
      return null;
    }
    default:
      return `unknown command`;
  }
}

/** Undo is free until the season ends: replay the season's commands minus the last. */
function undo(content: Content, state: RunState): CommandResult {
  if (state.seasonCommands.length === 0 || !state.seasonStart) return fail('nothing to undo');
  let s: RunState = {
    ...snapshot(state.seasonStart),
    seasonStart: state.seasonStart,
    seasonCommands: [],
  };
  for (const command of state.seasonCommands.slice(0, -1)) {
    const result = applyCommand(content, s, command);
    if (!result.ok) return fail(`undo replay failed: ${result.error}`);
    s = result.state;
  }
  return { ok: true, state: s };
}
