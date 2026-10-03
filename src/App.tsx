import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan, ProcessStep } from './model/types';
import { newId } from './model/types';
import { connectPorts } from './model/links';
import { solvePlan } from './model/solver';
import { samplePlan } from './model/sample';
import { stepToTemplate } from './model/templates';
import {
  activeWorkspace,
  createWorkspace,
  savePlanSnapshot,
  updateActivePlan,
  type SavedWorkspacePlan,
  type Workspace,
  type WorkspaceState,
} from './model/workspaces';
import { currentPlan, loadWorkspaceState, saveWorkspaceState } from './state/workspaces';
import { exportPlan } from './state/persistence';
import { ResourcePanel } from './components/ResourcePanel';
import { StepCard } from './components/StepCard';
import { ResultsPanel } from './components/ResultsPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { InteractiveField } from './components/InteractiveField';

function blankPlan(name: string): Plan {
  return { name, resources: [], steps: [], targets: [] };
}

function makePlanInWorkspace(workspace: Workspace, name: string): Workspace {
  const snapshot = savePlanSnapshot({ ...blankPlan(name), resources: workspace.resources });
  return { ...workspace, plans: [...workspace.plans, snapshot], activePlanId: snapshot.id };
}

export default function App() {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(loadWorkspaceState);
  const [selectedStepId, setSelectedStepId] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const workspace = activeWorkspace(workspaceState);
  const plan = useMemo(() => currentPlan(workspaceState), [workspaceState]);

  useEffect(() => saveWorkspaceState(workspaceState), [workspaceState]);
  const result = useMemo(() => solvePlan(plan), [plan]);
  const selectedStep = plan.steps.find((step) => step.id === selectedStepId);

  useEffect(() => {
    if (selectedStepId && !selectedStep) setSelectedStepId(undefined);
  }, [selectedStep, selectedStepId]);

  function updateActiveWorkspace(update: (current: Workspace) => Workspace) {
    setWorkspaceState((state) => ({
      ...state,
      workspaces: state.workspaces.map((item) =>
        item.id === state.activeWorkspaceId ? update(item) : item,
      ),
    }));
  }

  function updatePlan(nextPlan: Plan) {
    updateActiveWorkspace((current) => updateActivePlan(current, nextPlan));
  }

  function changeWorkspace(workspaceId: string) {
    setWorkspaceState((state) => ({ ...state, activeWorkspaceId: workspaceId }));
    setSelectedStepId(undefined);
  }

  function createNewWorkspace() {
    const name = prompt('Workspace name:');
    if (name === null || !name.trim()) return;
    const workspacePlan = { ...samplePlan(), name: 'Plan 1' };
    const created = createWorkspace(name, workspacePlan);
    setWorkspaceState((state) => ({
      workspaces: [...state.workspaces, created],
      activeWorkspaceId: created.id,
    }));
    setSelectedStepId(undefined);
  }

  function renameWorkspace() {
    const name = prompt('Workspace name:', workspace.name);
    if (name === null || !name.trim()) return;
    updateActiveWorkspace((current) => ({ ...current, name: name.trim() }));
  }

  function deleteWorkspace() {
    if (workspaceState.workspaces.length <= 1) {
      alert('Keep at least one workspace.');
      return;
    }
    if (!confirm(`Delete workspace “${workspace.name}” and all its plans and libraries?`)) return;
    const remaining = workspaceState.workspaces.filter((item) => item.id !== workspace.id);
    setWorkspaceState({ ...workspaceState, workspaces: remaining, activeWorkspaceId: remaining[0].id });
    setSelectedStepId(undefined);
  }

  function createPlan() {
    const name = prompt('New plan name:', `Plan ${workspace.plans.length + 1}`);
    if (name === null || !name.trim()) return;
    updateActiveWorkspace((current) => makePlanInWorkspace(current, name.trim()));
    setSelectedStepId(undefined);
  }

  function saveCurrentPlan() {
    updatePlan(plan);
  }

  function loadPlanById(planId: string) {
    const saved = workspace.plans.find((item) => item.id === planId);
    if (!saved) return;
    updateActiveWorkspace((current) => ({ ...current, activePlanId: planId }));
    setSelectedStepId(undefined);
  }

  function renamePlan() {
    const name = prompt('Plan name:', plan.name);
    if (name === null || !name.trim()) return;
    updatePlan({ ...plan, name: name.trim() });
  }

  function deletePlan() {
    if (workspace.plans.length <= 1) {
      alert('Keep at least one plan in each workspace.');
      return;
    }
    if (!confirm(`Delete plan “${plan.name}”?`)) return;
    updateActiveWorkspace((current) => {
      const plans = current.plans.filter((saved) => saved.id !== current.activePlanId);
      return { ...current, plans, activePlanId: plans[0].id };
    });
    setSelectedStepId(undefined);
  }

  function saveStepAsTemplate(step: ProcessStep) {
    const name = prompt('Template name:', step.name || 'Unnamed step');
    if (name === null) return;
    updateActiveWorkspace((current) => ({
      ...current,
      stepTemplates: [...current.stepTemplates, stepToTemplate(step, plan, name)],
    }));
  }

  function addStepAt(x: number, y: number) {
    const step = { id: newId(), name: '', inputs: [], outputs: [], position: { x, y } };
    updatePlan({ ...plan, steps: [...plan.steps, step] });
    setSelectedStepId(step.id);
  }

  function moveStep(stepId: string, x: number, y: number) {
    updatePlan({
      ...plan,
      steps: plan.steps.map((step) => step.id === stepId ? { ...step, position: { x, y } } : step),
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
      const amount = { resourceId, amount: 1 };
      nextPlan = {
        ...plan,
        steps: plan.steps.map((step) => step.id !== targetStepId ? step : targetKind === 'input'
          ? { ...step, inputs: [...step.inputs, amount] }
          : { ...step, outputs: [...step.outputs, amount] }),
      };
    }
    updatePlan(connectPorts(
      nextPlan,
      { stepId: sourceStepId, kind: sourceKind, index: sourceIndex },
      { stepId: targetStepId, kind: targetKind, index: resolvedTargetIndex },
      resourceId,
    ));
  }

  async function importPlan(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Plan;
      if (!Array.isArray(parsed.resources) || !Array.isArray(parsed.steps)) throw new Error('not a plan file');
      updatePlan({
        ...parsed,
        name: parsed.name || 'Imported plan',
        targets: parsed.targets ?? [],
        resources: mergeResources(workspace.resources, parsed.resources),
      });
    } catch {
      alert('Could not import: not a valid plan file.');
    }
  }

  function resetToSample() {
    if (confirm('Replace the current plan with the sample plan?')) updatePlan({ ...samplePlan(), resources: workspace.resources });
  }

  const activeSaved: SavedWorkspacePlan | undefined = workspace.plans.find((saved) => saved.id === workspace.activePlanId);

  return (
    <div className="app">
      <header className="app-header">
        <div className="workspace-controls">
          <label>Workspace <select value={workspace.id} onChange={(event) => changeWorkspace(event.target.value)}>
            {workspaceState.workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <button type="button" onClick={createNewWorkspace}>New workspace</button>
          <button type="button" onClick={renameWorkspace}>Rename</button>
          <button type="button" onClick={deleteWorkspace} disabled={workspaceState.workspaces.length <= 1}>Delete</button>
        </div>
        <div className="plan-controls">
          <label>Plan <select value={activeSaved?.id ?? ''} onChange={(event) => loadPlanById(event.target.value)}>
            {workspace.plans.map((saved) => <option key={saved.id} value={saved.id}>{saved.name || 'Unnamed plan'}</option>)}
          </select></label>
          <button type="button" onClick={createPlan}>New plan</button>
          <button type="button" onClick={saveCurrentPlan}>Save</button>
          <button type="button" onClick={renamePlan}>Rename</button>
          <button type="button" onClick={deletePlan} disabled={workspace.plans.length <= 1}>Delete</button>
        </div>
        <input
          className="plan-name"
          aria-label="Plan name"
          value={plan.name}
          onChange={(event) => updatePlan({ ...plan, name: event.target.value })}
          title="Plan name"
        />
        <div className="header-actions">
          <button type="button" onClick={() => exportPlan(plan)}>Export</button>
          <button type="button" onClick={() => fileInput.current?.click()}>Import</button>
          <button type="button" onClick={resetToSample}>Sample</button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importPlan(file);
            event.target.value = '';
          }} />
        </div>
      </header>

      <main>
        <div className="left-col">
          <ResourcePanel plan={plan} onChange={updatePlan} />
          <LibraryPanel
            plan={plan}
            stepTemplates={workspace.stepTemplates}
            planTemplates={workspace.planTemplates}
            onChange={(nextPlan) => updatePlan({ ...nextPlan, resources: mergeResources(workspace.resources, nextPlan.resources) })}
            onStepTemplates={(templates) => updateActiveWorkspace((current) => ({ ...current, stepTemplates: templates }))}
            onPlanTemplates={(templates) => updateActiveWorkspace((current) => ({ ...current, planTemplates: templates }))}
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
                <button type="button" className="icon" onClick={() => setSelectedStepId(undefined)}>×</button>
              </div>
              <StepCard plan={plan} step={selectedStep} onChange={updatePlan} onSaveTemplate={saveStepAsTemplate} />
            </section>
          ) : (
            <section className="panel selection-empty">
              <h2>Selected step</h2>
              <p>Click a step in the field to edit its inputs, outputs, name, and timing.</p>
            </section>
          )}
          <ResultsPanel plan={plan} result={result} onChange={updatePlan} />
        </aside>
      </main>
    </div>
  );
}

function mergeResources(current: Plan['resources'], incoming: Plan['resources']): Plan['resources'] {
  const byId = new Map(current.map((resource) => [resource.id, resource]));
  for (const resource of incoming) byId.set(resource.id, resource);
  return [...byId.values()];
}
