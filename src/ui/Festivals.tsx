/**
 * Festivals and wildlife in the interface (EXPANSION.md, E4). A festival is a
 * cheap, optional choice in its season, once a year: held now, it pays off as
 * the season ends. The valley's animals are listed in the run overview with
 * what brings them and what they do.
 */
import type { GameStore } from '../game/store';
import { animals, festivalProblem, festivals, festivalThisSeason, habitatOf } from '../sim';
import { SEASON_NAMES } from './TopBar';

const cards = import.meta.glob('../art/festivals/*.card.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** A festival's card illustration, if it has one. */
export function festivalCard(id: string): string | null {
  return cards[`../art/festivals/${id}.card.webp`] ?? null;
}

const costText = (cost: Record<string, number | undefined>) =>
  Object.entries(cost)
    .map(([res, n]) => `${n} ${res}`)
    .join(', ');

/** This season's festival, to hold or call off; nothing in a season without one. */
export function FestivalPanel({ store }: { store: GameStore }) {
  const { state } = store;
  const content = store.rules;
  if (state.status !== 'active') return null;
  const f = festivals(content).find((x) => x.season === state.season);
  if (!f) return null;
  const held = festivalThisSeason(content, state)?.id === f.id;
  const problem = held ? null : festivalProblem(content, state, f.id);
  const card = festivalCard(f.id);
  return (
    <section aria-label="Festival" class={`festival${held ? ' held' : ''}`}>
      <div class="section-head">
        <h2>{f.name}</h2>
        <span class="quiet small">{SEASON_NAMES[f.season]} · once a year</span>
      </div>
      {card && <img class="festival-card" src={card} alt="" width={768} height={480} />}
      <div class="small">{f.text}</div>
      <div class="row small festival-row">
        <span class="quiet">
          {held ? `Held as ${SEASON_NAMES[f.season].toLowerCase()} ends` : costText(f.cost)}
        </span>
        {held ? (
          <button
            type="button"
            class="button small-button"
            onClick={() => store.dispatch({ type: 'cancelFestival', festival: f.id })}
          >
            Call off
          </button>
        ) : (
          <button
            type="button"
            class="button small-button"
            disabled={problem !== null}
            title={problem ?? undefined}
            onClick={() => store.dispatch({ type: 'holdFestival', festival: f.id })}
          >
            Hold it · {costText(f.cost)}
          </button>
        )}
      </div>
    </section>
  );
}

/** The valley's animals: who lives here, and what would bring the rest. */
export function WildlifeStatus({ store }: { store: GameStore }) {
  const { state } = store;
  const content = store.rules;
  const list = animals(content);
  if (list.length === 0) return null;
  return (
    <section aria-label="Wildlife">
      <h2>Wildlife</h2>
      <ul class="plain wildlife-list">
        {list.map((a) => {
          const here = state.wildlife.includes(a.id);
          const habitat = habitatOf(state, a);
          const why = here
            ? 'Living in the valley'
            : state.harmony < a.harmony
              ? `Come at Harmony ${a.harmony} (now ${state.harmony})`
              : habitat.tiles.length === 0
                ? 'No habitat for them yet'
                : 'Coming as next season starts';
          return (
            <li class={here ? 'here' : ''}>
              <strong>{a.name}</strong> <span class="quiet small">· {why}</span>
              <div class="small">{a.text}</div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
