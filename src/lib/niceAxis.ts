/** Numeric values only: callers must supply the plotted metric, never timestamps. */
export function niceAxis(values: number[], minimumStep = 0) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return { domain: [0, 1] as [number, number], ticks: [0, 1] };
  let low = Infinity, high = -Infinity;
  for (const value of finite) { low = Math.min(low, value); high = Math.max(high, value); }
  const padding = Math.max((high - low) * .08, Math.abs(high) * .01, minimumStep / 2, .01);
  const raw = (high - low + padding * 2) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(minimumStep, ([1, 2, 5, 10].find(n => n * magnitude >= raw) ?? 10) * magnitude);
  const min = Math.floor((low - padding) / step) * step, max = Math.ceil((high + padding) / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => Number((min + i * step).toPrecision(12)));
  return { domain: [min, max] as [number, number], ticks };
}
