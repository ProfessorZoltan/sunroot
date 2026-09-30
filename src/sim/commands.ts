/**
 * The only way to change a run: the client sends commands and draws the state
 * that comes back. Every command is pure: the input state is never mutated.
 */
import type { Content } from './content/load';
import { drawCards } from './draft';
import { hexKey } from './hex';
import { canPlace } from './placement';
import { computeHarmony, defOf, improveTile, isHome, tileAt } from './queries';
import { resolveSeason } from './season/resolve';
import { cloneState } from './snapshot';
import type { Command, CommandResult, RunState } from './types';

const fail = (error: string): CommandResult => ({ ok: false, error });

export function applyCommand(content: Content, state: RunState, command: Command): CommandResult {
  if (state.status !== 'active') return fail('the run has ended');
  if (command.type === 'undo') return undo(content, state);
  if (command.type === 'endSeason') {
    if (state.draft.offer.length > 0 && state.draft.picked === null) {
      return fail('pick a draft card before ending the season');
    }
    return { ok: true, state: resolveSeason(content, state) };
  }
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
      if (!s.unlocked.includes(command.card)) s.unlocked.push(command.card);
      return null;
    }
    case 'rerollDraft': {
      if (s.draft.picked !== null) return 'already picked a card this season';
      if (s.stores.knowledge < k.reroll) return `rerolling needs ${k.reroll} knowledge`;
      s.stores.knowledge -= k.reroll;
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
    case 'spreadCompost': {
      const tile = tileAt(s, command.at);
      if (!tile) return 'outside the valley';
      const cost = content.rules.compostPerTileStep;
      if (s.stores.compost < cost) return `spreading compost needs ${cost} compost`;
      if (!improveTile(content, tile, 1)) return `compost can't improve ${tile.type}`;
      s.stores.compost -= cost;
      return null;
    }
    case 'setRecipe': {
      const b = s.buildings[command.uid];
      const recipes = b && defOf(content, b).recipes;
      if (!b || !recipes) return 'that building has no recipes';
      if (!recipes.options.some((o) => o.id === command.recipe))
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
    ...structuredClone(state.seasonStart),
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
