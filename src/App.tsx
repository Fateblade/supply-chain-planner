import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan, ProcessStep } from './model/types';
import { newId } from './model/types';
import { connectPorts } from './model/links';
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
import { InteractiveField } from './components/InteractiveField';

export default function App() {
  const [plan, setPlan] = useState<Plan>(() => loadPlan() ?? samplePlan());
  const [stepTemplates, setStepTemplates] = useState(loadStepTemplates);
  const [planTemplates, setPlanTemplates] = useState(loadPlanTemplates);
  const [selectedStepId, setSelectedStepId] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => savePlan(plan), [plan]);
  useEffect(() => saveStepTemplates(stepTemplates), [stepTemplates]);
  useEffect(() => savePlanTemplates(planTemplates), [planTemplates]);
  const result = useMemo(() => solvePlan(plan), [plan]);
  const selectedStep = plan.steps.find((step) => step.id === selectedStepId);

  useEffect(() => {
    if (selectedStepId && !selectedStep) setSelectedStepId(undefined);
  }, [selectedStep, selectedStepId]);

  function saveStepAsTemplate(step: ProcessStep) {
    const name = prompt('Template name:', step.name || 'Unnamed step');
    if (name === null) return;
    setStepTemplates([...stepTemplates, stepToTemplate(step, plan, name)]);
  }

  function addStepAt(x: number, y: number) {
    const step = {
      id: newId(),
      name: '',
      inputs: [],
      outputs: [],
      position: { x, y },
    };
    setPlan({ ...plan, steps: [...plan.steps, step] });
    setSelectedStepId(step.id);
  }

  function moveStep(stepId: string, x: number, y: number) {
    setPlan({
      ...plan,
      steps: plan.steps.map((step) =>
        step.id === stepId ? { ...step, position: { x, y } } : step,
      ),
    });
  }

  function connectSteps(
    sourceStepId: string,
    sourceKind: 'input' | 'output',
    sourceIndex: number,
    resourceId: string,
    targetStepId: string,
    targetKind: 'input' | 'output',
    targetIndex?: number,
  ) {
    if (sourceStepId === targetStepId || sourceKind === targetKind) return;
    let nextPlan = plan;
    let resolvedTargetIndex = targetIndex;

    if (resolvedTargetIndex === undefined) {
      const target = plan.steps.find((step) => step.id === targetStepId);
      if (!target) return;
      resolvedTargetIndex = target[targetKind === 'input' ? 'inputs' : 'outputs'].length;
      const amounts = { resourceId, amount: 1 };
      nextPlan = {
        ...plan,
        steps: plan.steps.map((step) => {
          if (step.id !== targetStepId) return step;
          return targetKind === 'input'
            ? { ...step, inputs: [...step.inputs, amounts] }
            : { ...step, outputs: [...step.outputs, amounts] };
        }),
      };
    }

    setPlan(
      connectPorts(
        nextPlan,
        { stepId: sourceStepId, kind: sourceKind, index: sourceIndex },
        { stepId: targetStepId, kind: targetKind, index: resolvedTargetIndex },
        resourceId,
      ),
    );
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

        <InteractiveField
          plan={plan}
          selectedStepId={selectedStepId}
          onSelect={setSelectedStepId}
          onMove={moveStep}
          onAddStep={addStepAt}
          onConnect={connectSteps}
        />

        <aside className="right-col">
          {selectedStep ? (
            <section className="panel selected-step-panel">
              <div className="sidebar-heading">
                <h2>Selected step</h2>
                <button type="button" className="icon" onClick={() => setSelectedStepId(undefined)}>
                  ×
                </button>
              </div>
              <StepCard
                plan={plan}
                step={selectedStep}
                onChange={setPlan}
                onSaveTemplate={saveStepAsTemplate}
              />
            </section>
          ) : (
            <section className="panel selection-empty">
              <h2>Selected step</h2>
              <p>Click a step in the field to edit its inputs, outputs, name, and timing.</p>
            </section>
          )}
          <ResultsPanel plan={plan} result={result} onChange={setPlan} />
        </aside>
      </main>
    </div>
  );
}
