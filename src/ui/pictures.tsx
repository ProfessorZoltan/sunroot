/**
 * Combos as pictures (playtester): the buildings and tiles a card describes, drawn with the
 * map's own art, so a card can be matched to what stands on the map. The words stay beside
 * them; the pictures repeat them, so they are hidden from screen readers.
 */
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { comboPicture, type Join, type Piece, type Slot } from '../game/comboPicture';
import type { Combo, Content } from '../sim';

export interface Icons {
  buildings: Record<string, string>;
  tiles: Record<string, string>;
}

/** The interface's icons, rendered once the map's art is in (empty until then). */
export const IconsContext = createContext<Icons>({ buildings: {}, tiles: {} });

const JOINS: Record<Join, { glyph: string; title: string }> = {
  next: { glyph: '+', title: 'next to' },
  then: { glyph: '→', title: 'next to it, then' },
  line: { glyph: '—', title: 'in a straight line with' },
  becomes: { glyph: '⇒', title: 'becomes' },
  placed: { glyph: '↧', title: 'built over by' },
};

/** At most this many choices are drawn for one place; the rest are counted. */
const MAX_CHOICES = 3;

export type PictureSize = 'small' | 'large';

/** One building or tile: its icon, or a blank hex with its initial while art is loading. */
export function PieceIcon({ piece, size = 'small' }: { piece: Piece; size?: PictureSize }) {
  const icons = useContext(IconsContext);
  const src = piece.kind === 'tile' ? icons.tiles[piece.id] : icons.buildings[piece.id];
  const px = size === 'large' ? 44 : 26;
  return (
    <span class={`cp-piece cp-${piece.kind}`} title={piece.name}>
      {src ? (
        <img src={src} alt="" width={px} height={px} />
      ) : (
        <span class="cp-blank" style={{ width: `${px}px`, height: `${px}px` }}>
          {piece.name.charAt(0)}
        </span>
      )}
      {size === 'large' && <span class="cp-name">{piece.name}</span>}
    </span>
  );
}

function SlotView({ slot, size, ring }: { slot: Slot; size: PictureSize; ring: boolean }) {
  const shown = slot.pieces.slice(0, MAX_CHOICES);
  const more = slot.pieces.length - shown.length;
  return (
    <span class={`cp-slot${ring ? ' cp-ring' : ''}`}>
      {shown.length === 0 && (
        <span class="cp-piece" title="any building">
          <span class="cp-blank cp-any">any</span>
          {size === 'large' && <span class="cp-name">any building</span>}
        </span>
      )}
      {shown.map((p, i) => (
        <>
          {i > 0 && <span class="cp-or">or</span>}
          <PieceIcon piece={p} size={size} />
        </>
      ))}
      {more > 0 && <span class="cp-or">+{more}</span>}
      {slot.count > 1 && <span class="cp-count">×{slot.count}</span>}
    </span>
  );
}

/** A combo's picture: its pieces in the order its card reads, and what joins them. */
export function ComboPicture({
  content,
  combo,
  size = 'small',
}: {
  content: Content;
  combo: Combo;
  size?: PictureSize;
}) {
  const p = comboPicture(content, combo);
  if (p.slots.length === 0) return null;
  return (
    <figure class={`combo-picture ${size}`} aria-hidden="true">
      <span class="cp-row">
        {p.slots.map((slot, i) => (
          // A join stays with the piece after it, so a picture that wraps never ends on an arrow.
          <span class="cp-step">
            {i > 0 && (
              <span class="cp-join" title={p.ring ? 'ringed by' : JOINS[p.joins[i - 1]!].title}>
                {JOINS[p.joins[i - 1]!].glyph}
              </span>
            )}
            <SlotView slot={slot} size={size} ring={p.ring && i === 1} />
            {p.loop && i === p.slots.length - 1 && (
              <span class="cp-join cp-loop" title="and back to the first: the loop closes">
                ↺
              </span>
            )}
          </span>
        ))}
      </span>
      {size === 'large' && p.note && <figcaption class="cp-note">{p.note}</figcaption>}
    </figure>
  );
}
