// Display units (PRD §4.0): plans are stored in cm and m²; people read metres or feet-inches.

export type DisplayUnits = 'm' | 'ft_in';

const FT2_PER_M2 = 10.7639;

export function formatArea(m2: number, units: DisplayUnits): string {
  return units === 'm' ? `${m2.toFixed(2)} m²` : `${Math.round(m2 * FT2_PER_M2)} ft²`;
}

export function formatLength(cm: number, units: DisplayUnits): string {
  if (units === 'm') return `${(cm / 100).toFixed(2)} m`;
  const totalInches = Math.round(cm / 2.54);
  const sign = totalInches < 0 ? '−' : '';
  const abs = Math.abs(totalInches);
  return `${sign}${Math.floor(abs / 12)}′ ${abs % 12}″`;
}

const SCALE_STEPS_CM: Record<DisplayUnits, number[]> = {
  m: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
  ft_in: [1, 2, 5, 10, 20, 50, 100, 200].map((ft) => ft * 30.48),
};

/**
 * A round length for a scale bar at `pxPerCm` screen pixels per cm: the longest 1-2-5 step
 * (metres) or whole-feet step that fits in `maxPx`, so the bar always tells the truth.
 */
export function scaleBarLength(
  pxPerCm: number,
  units: DisplayUnits,
  maxPx = 120,
): { cm: number; px: number; label: string } {
  const steps = SCALE_STEPS_CM[units];
  const cm = steps.filter((s) => s * pxPerCm <= maxPx).at(-1) ?? steps[0]!;
  const label =
    units === 'ft_in' ? `${Math.round(cm / 30.48)}′` : cm < 100 ? `${cm} cm` : `${cm / 100} m`;
  return { cm, px: cm * pxPerCm, label };
}

const GRID_STEPS_CM: Record<DisplayUnits, number[]> = {
  m: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000],
  // 1″, 3″, 6″, 1′, 2′, 5′, 10′, 20′, 50′
  ft_in: [1, 3, 6, 12, 24, 60, 120, 240, 600].map((inch) => inch * 2.54),
};

/**
 * Spacing of the canvas dot grid (and the grid snap) at `pxPerCm`: the finest round step whose
 * dots stay at least `minPx` apart, so the grid always means a real length.
 */
export function gridStep(pxPerCm: number, units: DisplayUnits, minPx = 12): number {
  const steps = GRID_STEPS_CM[units];
  return steps.find((s) => s * pxPerCm >= minPx) ?? steps.at(-1)!;
}
