/** Die klassische Kegelaufstellung: 9 Kegel in Rautenform. Logo + Platzhalter-Motiv. */
const PINS: [number, number][] = [
  [50, 10], [32, 30], [68, 30], [14, 50], [50, 50], [86, 50], [32, 70], [68, 70], [50, 90],
];

export function PinDiamond({ className, fallen = [] }: { className?: string; fallen?: number[] }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {PINS.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === 4 ? 9 : 7.5}
          fill={fallen.includes(i) ? "transparent" : "currentColor"}
          stroke="currentColor"
          strokeWidth={fallen.includes(i) ? 2 : 0}
          className={i === 4 ? "text-messing" : "text-kreide"}
          opacity={fallen.includes(i) ? 0.35 : 1}
        />
      ))}
    </svg>
  );
}
