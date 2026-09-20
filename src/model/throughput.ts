import type { Plan } from './types';
import { solvePlan } from './solver';

export interface StepThroughput {
  stepId: string;
  /** Runs per second required to satisfy all rate-based targets. */
  runsPerSecond: number;
  /** Parallel stations needed to sustain the rate; null when the step has no
   *  duration set; 0 when nothing is required. */
  stations: number | null;
}

/**
 * How many parallel stations of each step kind are needed.
 *
 * The solver is linear in target amounts, so per-target solves can be summed:
 * each rate target contributes (runs for that target) / perSeconds.
 * One-off targets (no time frame) don't consume station capacity and are
 * ignored here — they still show up in the P1 runs table.
 */
export function stationRequirements(plan: Plan): Map<string, StepThroughput> {
  const rateTargets = plan.targets.filter(
    (t) => t.amount > 0 && t.perSeconds !== undefined && t.perSeconds > 0,
  );

  const runsPerSecond = new Map<string, number>();
  for (const t of rateTargets) {
    const r = solvePlan({
      ...plan,
      targets: [{ resourceId: t.resourceId, amount: t.amount }],
    });
    for (const [stepId, runs] of r.runs) {
      const add = runs / (t.perSeconds as number);
      if (add > 0) runsPerSecond.set(stepId, (runsPerSecond.get(stepId) ?? 0) + add);
    }
  }

  const out = new Map<string, StepThroughput>();
  for (const s of plan.steps) {
    const rps = runsPerSecond.get(s.id) ?? 0;
    let stations: number | null;
    if (rps <= 0) {
      stations = 0;
    } else if (s.durationSeconds && s.durationSeconds > 0) {
      stations = Math.ceil(rps * s.durationSeconds - 1e-9);
    } else {
      stations = null;
    }
    out.set(s.id, { stepId: s.id, runsPerSecond: rps, stations });
  }
  return out;
}
