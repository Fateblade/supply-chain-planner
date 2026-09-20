import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan, ProcessStep } from './model/types';
import { newId } from './model/types';
import { solvePlan } from './model/solver';
import { samplePlan } from './model/sample';
import { stepToTemplate } from './model/templates';
import { exportPlan, loadPlan, savePlan } from './state/persistence';
import {
  loadPlanTemplates,
  loadStepTemplates,
  savePlanTemplates,
  saveStepTemplates,
} from './state/library';
import { ResourcePanel } from './components/ResourcePanel';
import { StepCard } from './components/StepCard';
import { ResultsPanel } from './components/ResultsPanel';
import { LibraryPanel } from './components/LibraryPanel';

export default function App() {
  const [plan, setPlan] = useState<Plan>(() => loadPlan() ?? samplePlan());
  const [stepTemplates, setStepTemplates] = useState(loadStepTemplates);
  const [planTemplates, setPlanTemplates] = useState(loadPlanTemplates);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => savePlan(plan), [plan]);
  useEffect(() => saveStepTemplates(stepTemplates), [stepTemplates]);
  useEffect(() => savePlanTemplates(planTemplates), [planTemplates]);
  const result = useMemo(() => solvePlan(plan), [plan]);

  function saveStepAsTemplate(step: ProcessStep) {
    const name = prompt('Template name:', step.name || 'Unnamed step');
    if (name === null) return;
    setStepTemplates([...stepTemplates, stepToTemplate(step, plan, name)]);
  }

  function addStep() {
    if (plan.resources.length === 0) return;
    setPlan({
      ...plan,
      steps: [
        ...plan.steps,
        { id: newId(), name: '', inputs: [], outputs: [{ resourceId: plan.resources[0].id, amount: 1 }] },
      ],
    });
  }

  async function importPlan(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Plan;
      if (!Array.isArray(parsed.resources) || !Array.isArray(parsed.steps)) {
        throw new Error('not a plan file');
      }
      setPlan({ ...parsed, name: parsed.name || 'Imported plan', targets: parsed.targets ?? [] });
    } catch {
      alert('Could not import: not a valid plan file.');
    }
  }

  function resetToSample() {
    if (confirm('Replace the current plan with the sample plan?')) setPlan(samplePlan());
  }

  return (
    <div className="app">
      <header>
        <input
          className="plan-name"
          value={plan.name}
          onChange={(e) => setPlan({ ...plan, name: e.target.value })}
          title="Plan name"
        />
        <div className="header-actions">
          <button type="button" onClick={() => exportPlan(plan)}>
            Export
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Import
          </button>
          <button type="button" onClick={resetToSample}>
            Sample
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importPlan(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <main>
        <div className="left-col">
          <ResourcePanel plan={plan} onChange={setPlan} />
          <LibraryPanel
            plan={plan}
            stepTemplates={stepTemplates}
            planTemplates={planTemplates}
            onChange={setPlan}
            onStepTemplates={setStepTemplates}
            onPlanTemplates={setPlanTemplates}
          />
        </div>

        <section className="panel steps-panel">
          <h2>Process steps</h2>
          <button type="button" className="add-step" onClick={addStep} disabled={plan.resources.length === 0}>
            + Add step
          </button>
          {plan.resources.length === 0 && (
            <p className="empty-hint">Add a resource first, then steps can use it.</p>
          )}
          {plan.steps.map((s) => (
            <StepCard key={s.id} plan={plan} step={s} onChange={setPlan} onSaveTemplate={saveStepAsTemplate} />
          ))}
          {plan.steps.length === 0 && plan.resources.length > 0 && (
            <p className="empty-hint">No steps yet — add one to turn resources into other resources.</p>
          )}
        </section>

        <ResultsPanel plan={plan} result={result} onChange={setPlan} />
      </main>
    </div>
  );
}
