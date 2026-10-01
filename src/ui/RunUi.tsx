/**
 * The run's shape in the interface (Milestone 7): choosing a vision and
 * following its progress, the end-of-run screen with the score, the Graft
 * tier and the Graft offer, and starting a new run.
 */
import { useEffect, useRef } from 'preact/hooks';
import type { GameStore } from '../game/store';
import {
  cityRequest,
  eraGoal,
  goalProgress,
  graftOffer,
  scoreRun,
  seedsForRun,
  visionProgress,
  type Content,
} from '../sim';

/** At the start of a run: choose one vision (keys 1 and 2). */
export function VisionPanel({ store }: { store: GameStore }) {
  const { content, state } = store;
  return (
    <section aria-label="Vision">
      <h2>Choose a vision</h2>
      <div class="quiet small">
        A goal for this run, worth +{content.rules.score.visionBonus} to its score. Press 1 to{' '}
        {state.visionOffer.length}.
      </div>
      <div class="cards">
        {state.visionOffer.map((id, i) => {
          const vision = content.visions.find((v) => v.id === id)!;
          return (
            <button
              type="button"
              class="card charter"
              aria-keyshortcuts={String(i + 1)}
              onClick={() => store.dispatch({ type: 'pickVision', vision: id })}
            >
              <span class="jewel" style={{ background: '#2E8B6A' }}>
                <span class="charter-glyph" aria-hidden="true">
                  ☼
                </span>
              </span>
              <span class="card-body">
                <span class="card-kind">Vision</span>
                <span class="card-name">{vision.name}</span>
                <span class="card-text">{vision.text}</span>
              </span>
              <span class="keycap" aria-hidden="true">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Left column: this era's goal and how far it has come. */
export function EraGoalStatus({ store }: { store: GameStore }) {
  const { content, state } = store;
  const goal = eraGoal(content, state.era);
  if (!goal || state.status !== 'active') return null;
  const done = state.eraGoalsMet.includes(state.era);
  const progress = goalProgress(content, state, goal.goal);
  return (
    <section aria-label="Era goal">
      <h2>Era goal</h2>
      <div class="small">
        <strong>{content.rules.eras[state.era - 1]}:</strong> {goal.text}
        {done ? ' Met.' : ''}
      </div>
      {!done && (
        <>
          <div
            class="bar vision-bar"
            role="progressbar"
            aria-label="Era goal progress"
            aria-valuenow={Math.round(progress.share * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div class="bar-fill" style={{ width: `${progress.share * 100}%` }} />
          </div>
          <div class="quiet small">
            {progress.text}
            {goal.reward.knowledge > 0 ? ` · +${goal.reward.knowledge} knowledge` : ''}
          </div>
        </>
      )}
    </section>
  );
}

/** Left column: the expedition's twist and city request, and how far the request has come. */
export function ExpeditionStatus({ store }: { store: GameStore }) {
  const { content, state } = store;
  const twist = content.twists.find((t) => t.id === state.options.expedition?.twist);
  const region = content.regions.find((r) => r.id === state.options.expedition?.region);
  const request = cityRequest(content, state);
  if (!twist && !request && !region) return null;
  const met = state.requestMet !== null;
  const progress = request ? goalProgress(content, state, request.goal) : null;
  const bonus = content.progression?.seeds.cityRequest ?? 0;
  return (
    <section aria-label="Expedition">
      <h2>Expedition</h2>
      {region && (
        <div class="small">
          <strong>{region.name}</strong>
          {region.modifiers.length > 0 ? `: ${region.text}` : ''}
        </div>
      )}
      {twist && (
        <div class="small">
          <strong>{twist.name}</strong>
          {twist.modifiers.length > 0 ? `: ${twist.text}` : ''}
        </div>
      )}
      {request && (
        <>
          <div class="small">
            <strong>City request:</strong> {request.text}
            {met ? ' Met.' : ` +${bonus} Seeds if met.`}
          </div>
          {!met && progress && (
            <>
              <div
                class="bar vision-bar"
                role="progressbar"
                aria-label="City request progress"
                aria-valuenow={Math.round(progress.share * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div class="bar-fill" style={{ width: `${progress.share * 100}%` }} />
              </div>
              <div class="quiet small">{progress.text}</div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Left column: the run's vision and how far it has come. */
export function VisionStatus({ store }: { store: GameStore }) {
  const { content, state } = store;
  const vision = content.visions.find((v) => v.id === state.vision);
  if (!vision) return null;
  const done = state.visionAchieved !== null;
  const progress = visionProgress(content, state, vision);
  const year = done ? Math.floor(state.visionAchieved! / 4) + 1 : 0;
  return (
    <section aria-label="Vision">
      <h2>Vision</h2>
      <div class="small">
        <strong>{vision.name}</strong>
        {done ? ` · achieved in year ${year}` : ''}
      </div>
      <div class="quiet small">{vision.text}</div>
      {!done && (
        <>
          <div
            class="bar vision-bar"
            role="progressbar"
            aria-label={`${vision.name} progress`}
            aria-valuenow={Math.round(progress.share * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div class="bar-fill" style={{ width: `${progress.share * 100}%` }} />
          </div>
          <div class="quiet small">{progress.text}</div>
        </>
      )}
    </section>
  );
}

/**
 * The end of a run: the score and its Graft tier, the Seeds it earned, then
 * the Graft to plant in Root City if the Seeds in hand pay for it. Otherwise,
 * or if the player chooses, the Seeds are banked for a later run.
 */
export function EndScreen({
  store,
  onClose,
  onNewRun,
}: {
  store: GameStore;
  onClose: () => void;
  onNewRun: () => void;
}) {
  const { content, state } = store;
  const first = useRef<HTMLButtonElement>(null);
  const result = store.result;
  const sent = result !== null;
  useEffect(() => {
    // Focus the first button, and again after the next frame in case a closing
    // overlay or a late re-render took focus away.
    first.current?.focus();
    const again = requestAnimationFrame(() => {
      const dialog = first.current?.closest('[role="dialog"]');
      if (dialog && !dialog.contains(document.activeElement)) first.current?.focus();
    });
    return () => cancelAnimationFrame(again);
  }, [sent]);
  const score = scoreRun(content, state);
  const seeds = seedsForRun(content, state);
  const offer = graftOffer(content, state);
  const tierIndex = content.rules.score.tiers.indexOf(score.tier);
  const complete = state.status === 'complete';
  const vision = content.visions.find((v) => v.id === state.vision);
  const cost = content.progression?.graftCost ?? 0;
  const inHand = store.seedsInHand;
  const chosen = result?.graft
    ? content.districts.find((d) => d.id === result.graft!.district)
    : undefined;
  return (
    <div class="modal-backdrop">
      <div class="modal glass end" role="dialog" aria-modal="true" aria-label="The run has ended">
        <span class="card-kind">{complete ? 'Sprout complete' : 'Sprout ended'}</span>
        <h2 class="glass-title">
          {complete ? 'The valley is breathing again' : 'The settlement has scattered'}
        </h2>
        <p>
          {complete
            ? `Twelve years in ${content.name}: ${state.citizens} citizens, Harmony ${state.harmony}.`
            : `Wellbeing reached 0 in year ${state.year}. Every run still sends something home.`}
          {vision &&
            (state.visionAchieved !== null
              ? ` Vision achieved: ${vision.name}.`
              : ` The vision, ${vision.name}, was not reached.`)}
        </p>
        <table class="keys">
          {score.lines.map((l) => (
            <tr>
              <th>{l.reason}</th>
              <td>{l.points}</td>
            </tr>
          ))}
          <tr class="total">
            <th>Score: {score.tier.name} Graft</th>
            <td>{score.total}</td>
          </tr>
        </table>
        {score.lift && (
          <div class="small">
            {score.lift.by} lifted the Graft {score.lift.tiers} tier
            {score.lift.tiers > 1 ? 's' : ''}, to {score.tier.name}.
          </div>
        )}
        {score.next && (
          <div class="small">
            {score.next.points} more points would have made a {score.next.tier.name} Graft.
          </div>
        )}
        {seeds.total > 0 && (
          <div class="small seeds">
            Seeds earned: <strong>{seeds.total}</strong> (
            {seeds.lines.map((l) => `${l.reason}: ${l.points}`).join(', ')}).{' '}
            {store.bankedSeeds > 0 ? `With ${store.bankedSeeds} banked, ` : ''}
            <strong>{inHand}</strong> in hand; planting a Graft costs {cost}.
          </div>
        )}
        {!sent && store.canPlant && (
          <>
            <h3 class="glass-subtitle">Choose the Graft to plant in Root City</h3>
            <div class="graft-options">
              {offer.options.map((o, i) => (
                <button
                  type="button"
                  class="card graft"
                  ref={i === 0 ? first : undefined}
                  onClick={() => store.chooseGraft(o.district.id)}
                >
                  <span class="card-body">
                    <span class="card-kind">
                      {o.district.earnedBy}
                      {o.lean > 0 ? ` · ${Math.round(Math.min(1, o.lean) * 100)}% match` : ''}
                    </span>
                    <span class="card-name">{o.district.name}</span>
                    <span class="card-text">
                      {score.tier.name}:{' '}
                      {o.district.perks[Math.min(tierIndex, o.district.perks.length - 1)]!.text}.
                      Adds {cardLabel(content, o.district.adds)} to future drafts.
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {!sent && !store.canPlant && (
          <p class="small">
            Not enough Seeds to plant a Graft: {cost - inHand} more are needed. Bank them, and a
            later run can add to them.
          </p>
        )}
        {sent && (
          <p class="graft-sent" role="status">
            {result.graft
              ? `The ${chosen?.name ?? 'Graft'} is on its way to Root City as a ${score.tier.name} Graft. ${inHand - result.spent} Seeds are banked.`
              : `${inHand} Seeds are banked in Root City for the next run.`}
          </p>
        )}
        <div class="row">
          {!sent && (
            <button
              type="button"
              class={store.canPlant ? 'button' : 'button primary'}
              ref={store.canPlant ? undefined : first}
              onClick={() => store.bankSeeds()}
            >
              {store.canPlant ? 'Bank the Seeds instead' : 'Bank the Seeds'}
            </button>
          )}
          {sent && (
            <button type="button" class="button primary" ref={first} onClick={onNewRun}>
              Go to Root City
            </button>
          )}
          <button type="button" class="button" onClick={onClose}>
            Look at the valley
          </button>
        </div>
      </div>
    </div>
  );
}

/** A card's name and kind, such as "the Cider Press blueprint". */
export function cardLabel(content: Content, id: string): string {
  if (content.tuningById[id]) return `the ${content.tuningById[id].name} tuning`;
  if (content.charterById[id]) return `the ${content.charterById[id].name} charter`;
  return `the ${content.byId[id]?.name ?? id} blueprint`;
}

/** Asks before abandoning the run in progress. */
export function NewRunDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Start a new run?"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Start a new run?</h2>
        <p class="small">
          This run is saved as you play. Starting a new one abandons it; it sends no Graft home.
        </p>
        <div class="row">
          <button type="button" class="button" ref={cancel} onClick={onClose}>
            Keep playing
          </button>
          <button type="button" class="button primary" onClick={onConfirm}>
            Start a new run
          </button>
        </div>
      </div>
    </div>
  );
}

/** A playtest note, kept with the season being played. */
export function NoteDialog({
  season,
  onSave,
  onClose,
}: {
  season: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const text = useRef<HTMLTextAreaElement>(null);
  useEffect(() => text.current?.focus(), []);
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Playtest note"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSave(text.current?.value ?? '');
        }}
      >
        <h2>Note for {season}</h2>
        <p class="small quiet">
          Bored, stuck, surprised? It goes into the playtest log with this season (Help → Download
          CSV).
        </p>
        <textarea ref={text} rows={4} aria-label="Note" />
        <div class="row">
          <button type="button" class="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            class="button primary"
            onClick={() => onSave(text.current?.value ?? '')}
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
