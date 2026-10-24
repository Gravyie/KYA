/** Conservative startup hints; sustained frame timing remains the runtime authority.
 * Screen size is a layout constraint, not a GPU benchmark. No renderer fingerprinting.
 */
export function renderBudget({width = 1440, coarse = false, memory = 0, cores = 0} = {}) {
  const constrained = (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
  const compact = width < 760 || (coarse && width <= 1366) || constrained;
  return {compact, maxDpr: constrained ? 1 : compact ? 1.25 : 1.5,
    maxPixels: constrained ? 1_400_000 : compact ? 2_000_000 : 3_200_000,
    samples: compact ? 0 : 2};
}

export function renderRatio(budget, width, height, deviceDpr = 1, quality = 2) {
  const cap = quality === 2 ? budget.maxDpr : quality === 1 ? 1 : .8;
  return Math.min(deviceDpr, cap, Math.sqrt(budget.maxPixels / Math.max(1, width * height)));
}
