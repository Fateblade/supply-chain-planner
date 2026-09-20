import { useMemo } from 'react';
import type { Plan } from '../model/types';
import type { SolveResult } from '../model/solver';
import { stationRequirements } from '../model/throughput';
import { fmt } from '../format';

interface Props {
  plan: Plan;
  result: SolveResult;
  onChange: (plan: Plan) => void;
}

/** Right panel: target amounts + computed runs per step + resource balance. */
export function ResultsPanel({ plan, result, onChange }: Props) {
  const resourceName = (id: string) =>
    plan.resources.find((r) => r.id === id)?.name ?? '(deleted resource)';

  function setTargetAmount(rid: string, amount: number) {
    onChange({
      ...plan,
      targets: plan.targets.map((t) => (t.resourceId === rid ? { ...t, amount } : t)),
    });
  }

  function setTargetRate(rid: string, perSeconds: number | undefined) {
    onChange({
      ...plan,
      targets: plan.targets.map((t) => (t.resourceId === rid ? { ...t, perSeconds } : t)),
    });
  }

  const throughput = useMemo(() => stationRequirements(plan), [plan]);
  const hasRateTarget = plan.targets.some((t) => t.perSeconds !== undefined && t.perSeconds > 0);

  const activeSteps = plan.steps.filter((s) => (result.runs.get(s.id) ?? 0) > 0);
  const orderedBalances = [...result.balances].sort((a, b) => {
    const rank = { shortage: 0, raw: 1, surplus: 2, balanced: 3, unused: 4 } as const;
    return rank[a.status] - rank[b.status] || resourceName(a.resourceId).localeCompare(resourceName(b.resourceId));
  });

  return (
    <section className="panel">
      <h2>Targets &amp; Result</h2>

      {plan.targets.length === 0 && (
        <p className="empty-hint">
          Mark a resource as final with <b>★</b> in the resource list, then set how much you need.
        </p>
      )}

      {plan.targets.map((t) => (
        <div className="target-row" key={t.resourceId}>
          <span className="target-name">{resourceName(t.resourceId)}</span>
          <input
            type="number"
            min={0}
            step="any"
            value={t.amount}
            onChange={(e) => setTargetAmount(t.resourceId, Math.max(0, Number(e.target.value) || 0))}
          />
          <select
            value={t.perSeconds ?? 0}
            title="One-off total, or a rate per minute/hour (enables station counting)"
            onChange={(e) => {
              const v = Number(e.target.value);
              setTargetRate(t.resourceId, v > 0 ? v : undefined);
            }}
          >
            <option value={0}>total</option>
            <option value={60}>per min</option>
            <option value={3600}>per hour</option>
          </select>
        </div>
      ))}

      {plan.targets.length > 0 && (
        <>
          <h3>Runs needed</h3>
          {activeSteps.length === 0 && <p className="empty-hint">Nothing to produce yet.</p>}
          <table className="result-table">
            <tbody>
              {activeSteps.map((s) => {
                const tp = throughput.get(s.id);
                return (
                  <tr key={s.id}>
                    <td>{s.name || '(unnamed step)'}</td>
                    <td className="num">{fmt(result.runs.get(s.id) ?? 0)}×</td>
                    {hasRateTarget && (
                      <td className="num stations" title="Parallel stations needed for the rate">
                        {tp && tp.runsPerSecond > 0
                          ? tp.stations === null
                            ? `${fmt(tp.runsPerSecond)}/s · set s/run`
                            : `${tp.stations}× station${tp.stations === 1 ? '' : 's'} (${fmt(tp.runsPerSecond)}/s)`
                          : '–'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasRateTarget && (
            <p className="hint">
              Stations = runs/sec × sec/run, rounded up. Set <b>s/run</b> on a step card to get its
              station count.
            </p>
          )}

          <h3>Resources</h3>
          <table className="result-table">
            <tbody>
              {orderedBalances
                .filter((b) => b.status !== 'unused')
                .map((b) => (
                  <tr key={b.resourceId} className={`status-${b.status}`}>
                    <td>{resourceName(b.resourceId)}</td>
                    <td className="num">
                      {b.status === 'raw'
                        ? `need ${fmt(b.consumed - b.produced)}`
                        : b.status === 'shortage'
                          ? `missing ${fmt(-b.net)}`
                          : b.status === 'surplus'
                            ? `+${fmt(b.net)} extra`
                            : `✓ ${fmt(b.produced)}`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!result.feasible && (
            <p className="warning">
              ⚠ Some resources can't be fully supplied — add a step that produces them or mark them
              raw.
            </p>
          )}
        </>
      )}
    </section>
  );
}
