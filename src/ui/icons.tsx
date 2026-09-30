/** Stroke icons from the mockup (never colour alone: every icon has a label beside it). */
import type { JSX } from 'preact';

type IconProps = { size?: number; color?: string };

function svg(paths: JSX.Element, { size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

export const Sun = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>,
    { color: '#B8801C', ...p },
  );
export const Moon = (p: IconProps) =>
  svg(<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />, { color: '#4A6B94', ...p });
export const Leaf = (p: IconProps) =>
  svg(
    <>
      <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" />
      <path d="M5 19l7-7" />
    </>,
    { color: '#4E7F46', ...p },
  );
export const Heart = (p: IconProps) =>
  svg(<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />, {
    color: '#B8506A',
    ...p,
  });
export const People = (p: IconProps) =>
  svg(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.3c3.2 0 5.5 2.2 5.5 5.7" />
    </>,
    { color: '#5E6B58', ...p },
  );
export const Person = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="7" r="3" />
      <path d="M6 20c0-3.5 2.7-6.5 6-6.5s6 3 6 6.5" />
    </>,
    { color: '#5E6B58', ...p },
  );
export const Wind = (p: IconProps) =>
  svg(
    <>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 12h16a3 3 0 1 1-3 3" />
      <path d="M3 16h8" />
    </>,
    { color: '#4A6B94', ...p },
  );
export const Undo = (p: IconProps) =>
  svg(
    <>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 0 10h-2" />
    </>,
    { color: '#2F3B2E', ...p },
  );
export const Arrow = (p: IconProps) =>
  svg(<path d="M5 12h14M13 6l6 6-6 6" />, { color: '#2B2410', ...p });
export const Reroll = (p: IconProps) =>
  svg(
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </>,
    { color: '#3E6E73', ...p },
  );

const RESOURCE_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  materials: (p) =>
    svg(
      <>
        <rect x="3" y="6" width="18" height="12" rx="1" />
        <path d="M3 12h18M9 6v6M15 12v6" />
      </>,
      { color: '#B0643A', ...p },
    ),
  food: (p) =>
    svg(
      <>
        <path d="M12 21V8" />
        <path d="M12 9c-3 0-4-3-4-5 3 0 4 2 4 5zM12 9c3 0 4-3 4-5-3 0-4 2-4 5zM12 15c-3 0-4-3-4-5 3 0 4 2 4 5zM12 15c3 0 4-3 4-5-3 0-4 2-4 5z" />
      </>,
      { color: '#A8841F', ...p },
    ),
  biomass: (p) =>
    svg(
      <>
        <path d="M6 20c0-7 4-13 12-15 1 8-4 14-12 15z" />
        <path d="M6 20l6-7" />
      </>,
      { color: '#6F9A5C', ...p },
    ),
  salvage: (p) =>
    svg(
      <>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      </>,
      { color: '#6B5E4A', ...p },
    ),
  compost: (p) =>
    svg(
      <>
        <path d="M12 20v-8" />
        <path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 14c0-3 2-5 6-5 0 3-2 5-6 5z" />
        <path d="M6 20h12" />
      </>,
      { color: '#7D5A3C', ...p },
    ),
  knowledge: (p) =>
    svg(
      <>
        <path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z" />
        <path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z" />
      </>,
      { color: '#3E6E73', ...p },
    ),
  scraps: (p) =>
    svg(
      <>
        <path d="M7 10c0-3 2-5 5-5s5 2 5 5-2 6-5 9c-3-3-5-6-5-9z" />
      </>,
      { color: '#8C7B5E', ...p },
    ),
  clutter: (p) =>
    svg(
      <>
        <path d="M4 18h16" />
        <path d="M6 18l2-5h8l2 5" />
        <path d="M10 13l1-3h2l1 3" />
      </>,
      { color: '#8C7B5E', ...p },
    ),
};

export function ResourceIcon({ resource, ...p }: IconProps & { resource: string }) {
  return (RESOURCE_ICONS[resource] ?? RESOURCE_ICONS.scraps!)(p);
}
