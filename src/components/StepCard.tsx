import { useEffect, useRef } from 'react';
import type { Plan, ProcessStep, ResourceAmount } from '../model/types';
import { removePortAndLinks } from '../model/links';
import { newId } from '../model/types';

interface Props {
  plan: Plan;
  step: ProcessStep;
  onChange: (plan: Plan) => void;
  onSaveTemplate: (step: ProcessStep) => void;
  /** True when an identical copy of this step is already in the library. */
  inLibrary?: boolean;
  /** Opens the delete confirmation (shared with the Delete hotkey). */
  onDelete: () => void;
}

/** One process step card: name, input rows, output rows, duplicate/delete. */
export function StepCard({ plan, step, onChange, onSaveTemplate, inLibrary = false, onDelete }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);

  // A freshly created (or still unnamed) step gets the cursor in its name
  // field right away; Enter confirms and leaves the field.
  useEffect(() => {
    if (!step.name) nameRef.current?.focus();
    // Mount-only: the card is keyed by step id, so each selection remounts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function patchStep(patch: Partial<ProcessStep>) {
    onChange({
      ...plan,
      steps: plan.steps.map((s) => (s.id === step.id ? { ...s, ...patch } : s)),
    });
  }

  function patchAmount(kind: 'inputs' | 'outputs', idx: number, patch: Partial<ResourceAmount>) {
    patchStep({
      [kind]: step[kind].map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    } as Partial<ProcessStep>);
  }

  function addRow(kind: 'inputs' | 'outputs') {
    const first = plan.resources[0];
    if (!first) return;
    patchStep({
      [kind]: [...step[kind], { resourceId: first.id, amount: 1 }],
    } as Partial<ProcessStep>);
  }

  function removeRow(kind: 'inputs' | 'outputs', idx: number) {
    onChange(removePortAndLinks(plan, step.id, kind === 'inputs' ? 'input' : 'output', idx));
  }

  function duplicate() {
    const copy: ProcessStep = {
      ...step,
      id: newId(),
      name: `${step.name} (copy)`,
      inputs: step.inputs.map((a) => ({ ...a })),
      outputs: step.outputs.map((a) => ({ ...a })),
    };
    const idx = plan.steps.findIndex((s) => s.id === step.id);
    const steps = [...plan.steps];
    steps.splice(idx + 1, 0, copy);
    onChange({ ...plan, steps });
  }

  function remove() {
    onDelete();
  }

  function renderRows(kind: 'inputs' | 'outputs') {
    return (
      <div className="io-group">
        <div className="io-label">{kind === 'inputs' ? 'Needs' : 'Makes'}</div>
        {step[kind].map((a, i) => (
          <div className="io-row" key={i}>
            <input
              className="qty"
              type="number"
              min={0}
              step="any"
              value={a.amount}
              onChange={(e) =>
                patchAmount(kind, i, { amount: Math.max(0, Number(e.target.value) || 0) })
              }
            />
            <select
              value={a.resourceId}
              onChange={(e) => patchAmount(kind, i, { resourceId: e.target.value })}
            >
              {plan.resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button type="button" className="icon danger" onClick={() => removeRow(kind, i)}>
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="link"
          onClick={() => addRow(kind)}
          disabled={plan.resources.length === 0}
        >
          + add {kind === 'inputs' ? 'input' : 'output'}
        </button>
      </div>
    );
  }

  return (
    <div className="step-card">
      <div className="step-head">
        <input
          ref={nameRef}
          className="step-name"
          value={step.name}
          placeholder="Step name"
          onChange={(e) => patchStep({ name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <button
          type="button"
          className={`icon star ${inLibrary ? 'saved' : ''}`}
          disabled={inLibrary}
          title={
            inLibrary
              ? 'Already saved in the library'
              : 'Save as reusable template (appears in the Library)'
          }
          onClick={() => onSaveTemplate(step)}
        >
          {inLibrary ? '★' : '☆'}
        </button>
      </div>
      <div className="step-controls">
        <input
          className="duration"
          type="number"
          min={0}
          step="any"
          placeholder="s/run"
          title="Seconds per run (needed for station counting)"
          value={step.durationSeconds ?? ''}
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0);
            patchStep({ durationSeconds: v });
          }}
        />
        <div className="step-actions">
          <button type="button" className="icon" title="Duplicate step" onClick={duplicate}>
            ⧉
          </button>
          <button type="button" className="icon danger" title="Delete step" onClick={remove}>
            D
          </button>
        </div>
      </div>
      <div className="step-body">
        {renderRows('inputs')}
        <div className="arrow" aria-hidden="true">↓</div>
        {renderRows('outputs')}
      </div>
    </div>
  );
}
