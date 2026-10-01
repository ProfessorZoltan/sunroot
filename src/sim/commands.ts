/**
 * The only way to change a run: the client sends commands and draws the state
 * that comes back. Every command is pure: the input state is never mutated.
 */
import type { Content } from './content/load';
import { AUTO_RECIPE, type Resource } from './content/schema';
import { demolish, demolishCheck } from './demolish';
import { projectBlocked } from './projects';
import { drawCards, isTuning } from './draft';
import { hexKey } from './hex';
import { canPlace } from './placement';
import { evolve, hintable, placementEvolution } from './combos';
import { effectiveContent } from './content/modifiers';
import { buildingAt, computeHarmony, defOf, improveTile, isHome, tileAt } from './queries';
import { flow } from './season/context';
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
      if (s.stores.knowledge < k.reroll) return `rerolling needs ${k.reroll} knowledge`;
      s.stores.knowledge -= k.reroll;
      flow(s.spent, 'knowledge', 'used', 'Rerolling the draft', k.reroll);
      const count = content.rules.draftCards + (s.draft.extraBought ? 1 : 0);
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
      s.stores.materials -= def.cost;
      flow(s.spent, 'materials', 'used', `Building: ${def.name}`, def.cost);
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
      if (def.recipes) b.recipe = def.recipes.defaultRecipe;
      if (def.digester) b.slot = def.digester.defaultSlot;
      if (def.storage) b.stored = 0;
      if (def.setsTile)
        improveTile(content, tileAt(s, b.at)!, content.rules.landHealth.length, def.setsTile);
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
    case 'demolish': {
      const check = demolishCheck(content, s, command.uid);
      const err = demolish(content, s, command.uid);
      if (err) return err;
      flow(s.spent, check.into, 'made', 'Demolition rubble', check.rubble);
      return null;
    }
    case 'spreadCompost': {
      const tile = tileAt(s, command.at);
      if (!tile) return 'outside the valley';
      const cost = content.rules.compostPerTileStep;
      if (s.stores.compost < cost) return `spreading compost needs ${cost} compost`;
      if (!improveTile(content, tile, 1)) return `compost can't improve ${tile.type}`;
      s.stores.compost -= cost;
      flow(s.spent, 'compost', 'used', 'Spread on the land', cost);
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
