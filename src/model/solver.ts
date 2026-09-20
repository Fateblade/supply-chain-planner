import type { Plan } from './types';

const EPS = 1e-9;
/** Tolerance for classifying a resource balance as shortage/surplus. */
const BALANCE_EPS = 1e-4;
/** Target rows outweigh intermediate-balance rows: meet demand even when the
 *  plan can't supply every input (the shortfall is then reported, not shared). */
const TARGET_WEIGHT = 1e6;

export type BalanceStatus = 'balanced' | 'surplus' | 'shortage' | 'raw' | 'unused';

export interface ResourceBalance {
  resourceId: string;
  produced: number;
  consumed: number;
  /** Targeted (final) demand for this resource. */
  demand: number;
  /** produced - consumed - demand. ~0 means the plan balances. */
  net: number;
  status: BalanceStatus;
}

export interface SolveResult {
  /** stepId -> number of times the step must run. */
  runs: Map<string, number>;
  balances: ResourceBalance[];
  /** False when a non-raw resource cannot be fully supplied. */
  feasible: boolean;
}

/**
 * Demand-driven backward calculation.
 *
 * For every non-raw resource that is consumed or targeted we require
 *   sum(runs_s * netProduction_s,r) = demand_r
 * and solve the least-squares system with non-negative runs. Steps whose
 * solution goes negative are removed (active-set clamping) and the system
 * is re-solved, so unused alternative producers end up at 0 runs.
 */
export function solvePlan(plan: Plan): SolveResult {
  const steps = plan.steps.filter((s) => s.outputs.length > 0);
  const demand = new Map<string, number>();
  for (const t of plan.targets) {
    if (t.amount > 0) demand.set(t.resourceId, (demand.get(t.resourceId) ?? 0) + t.amount);
  }
  const rawIds = new Set(plan.resources.filter((r) => r.isRaw).map((r) => r.id));

  // net production of resource r per single run of step s
  const netPerRun = steps.map((s) => {
    const net = new Map<string, number>();
    for (const o of s.outputs) net.set(o.resourceId, (net.get(o.resourceId) ?? 0) + o.amount);
    for (const i of s.inputs) net.set(i.resourceId, (net.get(i.resourceId) ?? 0) - i.amount);
    return net;
  });

  const consumedSomewhere = new Set<string>();
  for (const s of plan.steps) for (const i of s.inputs) consumedSomewhere.add(i.resourceId);

  // Constrained rows: non-raw resources that are consumed or targeted.
  const rowResourceIds: string[] = [];
  const rowWeights: number[] = [];
  for (const id of new Set([...consumedSomewhere, ...demand.keys()])) {
    if (rawIds.has(id)) continue;
    rowResourceIds.push(id);
    rowWeights.push(demand.has(id) ? TARGET_WEIGHT : 1);
  }

  const runs = new Map<string, number>();
  for (const s of plan.steps) runs.set(s.id, 0);

  if (steps.length > 0 && rowResourceIds.length > 0) {
    // A[r][s] = net production of row resource r per run of step s
    const A = rowResourceIds.map((rid) => netPerRun.map((net) => net.get(rid) ?? 0));
    const b = rowResourceIds.map((rid) => demand.get(rid) ?? 0);
    const x = solveNonNegativeLeastSquares(A, b, rowWeights);
    steps.forEach((s, i) => runs.set(s.id, x[i] < EPS ? 0 : x[i]));
  }

  // Balances for every resource touched by the plan.
  const touched = new Set<string>();
  for (const s of plan.steps) for (const a of [...s.inputs, ...s.outputs]) touched.add(a.resourceId);
  for (const id of demand.keys()) touched.add(id);

  const balances: ResourceBalance[] = [];
  let feasible = true;
  for (const rid of touched) {
    let produced = 0;
    let consumed = 0;
    steps.forEach((s) => {
      const r = runs.get(s.id) ?? 0;
      for (const o of s.outputs) if (o.resourceId === rid) produced += r * o.amount;
      for (const inp of s.inputs) if (inp.resourceId === rid) consumed += r * inp.amount;
    });
    const d = demand.get(rid) ?? 0;
    const net = produced - consumed - d;

    let status: BalanceStatus;
    if (rawIds.has(rid)) {
      status = 'raw';
    } else if (produced < EPS && consumed < EPS && d < EPS) {
      status = 'unused';
    } else if (net < -BALANCE_EPS) {
      status = 'shortage';
      feasible = false;
    } else if (net > BALANCE_EPS) {
      status = 'surplus';
    } else {
      status = 'balanced';
    }
    balances.push({ resourceId: rid, produced, consumed, demand: d, net, status });
  }

  return { runs, balances, feasible };
}

function solveNonNegativeLeastSquares(A: number[][], b: number[], w: number[]): number[] {
  const n = A[0].length;
  let active = Array.from({ length: n }, (_, i) => i);

  for (let iter = 0; iter <= n; iter++) {
    const x = solveLeastSquaresOnActive(A, b, w, active);
    const full = new Array<number>(n).fill(0);
    active.forEach((col, i) => (full[col] = x[i]));
    const worst = full.reduce((w, v, i) => (v < full[w] ? i : w), 0);
    if (full[worst] >= -EPS) return full.map((v) => (v < EPS ? 0 : v));
    active = active.filter((col) => col !== worst);
  }
  return new Array<number>(n).fill(0);
}

function solveLeastSquaresOnActive(
  A: number[][],
  b: number[],
  w: number[],
  active: number[],
): number[] {
  const k = active.length;
  // Weighted normal equations (AᵀWA + λI) x = AᵀWb over the active columns.
  const ata = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const atb = new Array<number>(k).fill(0);
  for (let r = 0; r < A.length; r++) {
    for (let i = 0; i < k; i++) {
      const ari = A[r][active[i]];
      if (ari === 0) continue;
      atb[i] += w[r] * ari * b[r];
      for (let j = 0; j < k; j++) ata[i][j] += w[r] * ari * A[r][active[j]];
    }
  }
  // λ must stay tiny even against the 1-weight balance rows: with target rows
  // weighted 1e6, a max-scaled λ would visibly under-supply intermediates.
  let maxDiag = 1;
  for (let i = 0; i < k; i++) maxDiag = Math.max(maxDiag, ata[i][i]);
  const reg = 1e-12 * maxDiag;
  for (let i = 0; i < k; i++) ata[i][i] += reg;
  return gaussianElimination(ata, atb);
}

/** Solves a n×n system via Gauss–Jordan elimination with partial pivoting. */
function gaussianElimination(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    }
    [m[col], m[piv]] = [m[piv], m[col]];
    if (Math.abs(m[col][col]) < EPS) m[col][col] = EPS;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / m[i][i]);
}
