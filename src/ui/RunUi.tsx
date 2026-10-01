/**
 * The run's shape in the interface (Milestone 7): choosing a vision and
 * following its progress, the end-of-run screen with the score, the Graft
 * tier and the Graft offer, and starting a new run.
 */
import { useEffect, useRef } from 'preact/hooks';
import type { GameStore } from '../game/store';
import { graftOffer, scoreRun, visionProgress } from '../sim';

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

/** The end of a run: the score and its Graft tier, then the Graft to send home. */
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
  const sent = store.graft !== null;
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
  const offer = graftOffer(content, state);
  const tierIndex = content.rules.score.tiers.indexOf(score.tier);
  const complete = state.status === 'complete';
  const vision = content.visions.find((v) => v.id === state.vision);
  const chosen = store.graft
    ? content.districts.find((d) => d.id === store.graft!.district)
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
        {score.next && (
          <div class="small">
            {score.next.points} more points would have made a {score.next.tier.name} Graft.
          </div>
        )}
        {!sent ? (
          <>
            <h3 class="glass-subtitle">Choose the Graft to send to Root City</h3>
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
                      {o.district.perks[Math.min(tierIndex, o.district.perks.length - 1)]}. Adds{' '}
                      {o.district.addsToDraft} to future drafts.
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p class="graft-sent" role="status">
            The {chosen?.name ?? 'Graft'} is on its way to Root City as a {score.tier.name} Graft.
          </p>
        )}
        <div class="row">
          {sent && (
            <button type="button" class="button primary" ref={first} onClick={onNewRun}>
              Start a new run
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
