/**
 * Single-series trend line — the one chart form this app needs (strength,
 * bodyweight, waist over time). Built to the dataviz specs: a 2px line, a
 * ~10% area wash, an end-dot with a 2px surface ring and a direct end label,
 * hairline recessive gridlines, a crosshair + tooltip that snaps to the
 * nearest point on hover or arrow keys, and a table view so no value is
 * hover-gated. One series means no legend — the title names it. Two
 * measures never share an axis: weight and waist are separate charts.
 */

import { useId, useState } from 'react';

export interface TrendPoint {
  at: number;
  value: number;
}

export interface TrendChartProps {
  title: string;
  points: TrendPoint[];
  unit: string;
  /** Whether a falling line is the good direction (bodyweight, waist). */
  lowerIsBetter?: boolean;
  width?: number;
  height?: number;
}

const PAD = { top: 10, right: 44, bottom: 18, left: 8 };

function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

function shortDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function TrendChart({ title, points, unit, lowerIsBetter = false, width = 320, height = 120 }: TrendChartProps) {
  const id = useId();
  const [active, setActive] = useState<number | undefined>();

  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.max(1, hi * 0.05);
  const yMin = lo - span * 0.15;
  const yMax = hi + span * 0.15;
  const t0 = points[0]!.at;
  const t1 = points.at(-1)!.at;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const x = (at: number) => PAD.left + (t1 === t0 ? innerW / 2 : ((at - t0) / (t1 - t0)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(t1).toFixed(1)},${PAD.top + innerH} L${x(t0).toFixed(1)},${PAD.top + innerH} Z`;
  const last = points.at(-1)!;
  const first = points[0]!;
  const delta = last.value - first.value;
  const improving = delta === 0 ? undefined : lowerIsBetter ? delta < 0 : delta > 0;
  const shown = active !== undefined ? points[active]! : undefined;

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < points.length; i += 1) {
      if (Math.abs(x(points[i]!.at) - px) < Math.abs(x(points[best]!.at) - px)) best = i;
    }
    return best;
  };

  return (
    <figure className="trend-chart" aria-labelledby={`${id}-title`}>
      <figcaption className="trend-chart__head">
        <span id={`${id}-title`} className="trend-chart__title">
          {title}
        </span>
        {points.length > 1 && (
          <span className="trend-chart__delta">
            {delta > 0 ? '▲ ' : delta < 0 ? '▼ ' : ''}
            {fmt(Math.round(Math.abs(delta) * 10) / 10)} {unit} since {shortDate(first.at)}
            {improving && ' · on track'}
          </span>
        )}
      </figcaption>
      <div className="trend-chart__plot">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          role="img"
          aria-label={`${title}: latest ${fmt(last.value)} ${unit}`}
          tabIndex={0}
          onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActive(undefined)}
          onBlur={() => setActive(undefined)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1));
            if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
          }}
        >
          {niceTicks(yMin, yMax).map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="trend-chart__grid" />
              <text x={width - PAD.right + 6} y={y(t) + 3} className="trend-chart__tick">
                {fmt(t)}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={height - 4} className="trend-chart__tick">
            {shortDate(t0)}
          </text>
          {t1 !== t0 && (
            <text x={width - PAD.right} y={height - 4} textAnchor="end" className="trend-chart__tick">
              {shortDate(t1)}
            </text>
          )}
          {points.length > 1 && <path d={area} className="trend-chart__area" />}
          <path d={line} className="trend-chart__line" />
          {shown && (
            <line x1={x(shown.at)} x2={x(shown.at)} y1={PAD.top} y2={PAD.top + innerH} className="trend-chart__crosshair" />
          )}
          <circle cx={x((shown ?? last).at)} cy={y((shown ?? last).value)} r={4.5} className="trend-chart__dot" />
        </svg>
        <div className="trend-chart__value" data-numeric>
          {fmt(Math.round((shown ?? last).value * 10) / 10)} {unit}
          <span className="trend-chart__value-date">{shortDate((shown ?? last).at)}</span>
        </div>
      </div>
      <details className="trend-chart__table">
        <summary>Table</summary>
        <table>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.at}>
                <td>{shortDate(p.at)}</td>
                <td data-numeric>
                  {fmt(Math.round(p.value * 10) / 10)} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
