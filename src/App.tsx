import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan, ProcessStep } from './model/types';
import { newId } from './model/types';
import { connectPorts } from './model/links';
import { solvePlan } from './model/solver';
import { samplePlan } from './model/sample';
import { stepToTemplate } from './model/templates';
import {
  activeSavedPlan,
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
import { WorkspacePanel } from './components/WorkspacePanel';
import { InteractiveField } from './components/InteractiveField';
import { Modal, type DialogRequest } from './components/Modal';

function blankPlan(name: string): Plan {
  return { name, resources: [], steps: [], targets: [] };
}

function makePlanInWorkspace(workspace: Workspace, name: string): Workspace {
  const snapshot = savePlanSnapshot({ ...blankPlan(name), resources: workspace.resources });
  return { ...workspace, plans: [...workspace.plans, snapshot], activePlanId: snapshot.id };
}

export default function App() {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(loadWorkspaceState);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const dialogKey = useRef(0);

  /** Open a modal dialog; the key forces a fresh Modal instance per request. */
  function ask(request: DialogRequest) {
    dialogKey.current += 1;
    setDialog(request);
  }
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
    setDialog({
      kind: 'prompt',
      title: 'New workspace',
      label: 'Workspace name',
      confirmLabel: 'Create',
      onConfirm: (value) => {
        const created = createWorkspace(value.trim(), { ...samplePlan(), name: 'Plan 1' });
        setWorkspaceState((state) => ({
          workspaces: [...state.workspaces, created],
          activeWorkspaceId: created.id,
        }));
        setSelectedStepId(undefined);
      },
    });
  }

  function renameWorkspace() {
    setDialog({
      kind: 'prompt',
      title: 'Rename workspace',
      label: 'Workspace name',
      initial: workspace.name,
      confirmLabel: 'Rename',
      onConfirm: (value) => updateActiveWorkspace((current) => ({ ...current, name: value.trim() })),
    });
  }

  function deleteWorkspace() {
    if (workspaceState.workspaces.length <= 1) {
      ask({
        kind: 'confirm',
        title: 'Cannot delete workspace',
        message: 'Keep at least one workspace.',
        confirmLabel: 'OK',
        info: true,
        onConfirm: () => undefined,
      });
      return;
    }
    ask({
      kind: 'confirm',
      title: 'Delete workspace',
      message: `Delete workspace “${workspace.name}” and all its plans and libraries? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        setWorkspaceState((state) => {
          const remaining = state.workspaces.filter((item) => item.id !== workspace.id);
          return { ...state, workspaces: remaining, activeWorkspaceId: remaining[0].id };
        });
        setSelectedStepId(undefined);
      },
    });
  }

  function createPlan() {
    ask({
      kind: 'prompt',
      title: 'New plan',
      label: 'Plan name',
      initial: `Plan ${workspace.plans.length + 1}`,
      confirmLabel: 'Create',
      onConfirm: (value) => {
        updateActiveWorkspace((current) => makePlanInWorkspace(current, value.trim()));
        setSelectedStepId(undefined);
      },
    });
  }

  function loadPlanById(planId: string) {
    const saved = workspace.plans.find((item) => item.id === planId);
    if (!saved) return;
    updateActiveWorkspace((current) => ({ ...current, activePlanId: planId }));
    setSelectedStepId(undefined);
  }

  function renamePlan() {
    ask({
      kind: 'prompt',
      title: 'Rename plan',
      label: 'Plan name',
      initial: plan.name,
      confirmLabel: 'Rename',
      onConfirm: (value) => updatePlan({ ...plan, name: value.trim() }),
    });
  }

  function deletePlan() {
    if (workspace.plans.length <= 1) {
      ask({
        kind: 'confirm',
        title: 'Cannot delete plan',
        message: 'Keep at least one plan in each workspace.',
        confirmLabel: 'OK',
        info: true,
        onConfirm: () => undefined,
      });
      return;
    }
    ask({
      kind: 'confirm',
      title: 'Delete plan',
      message: `Delete plan “${plan.name || 'Unnamed plan'}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        updateActiveWorkspace((current) => {
          const plans = current.plans.filter((saved) => saved.id !== current.activePlanId);
          return { ...current, plans, activePlanId: plans[0].id };
        });
        setSelectedStepId(undefined);
      },
    });
  }

  function saveStepAsTemplate(step: ProcessStep) {
    ask({
      kind: 'prompt',
      title: 'Save step template',
      label: 'Template name',
      initial: step.name || 'Unnamed step',
      confirmLabel: 'Save',
      onConfirm: (value) => {
        updateActiveWorkspace((current) => ({
          ...current,
          stepTemplates: [...current.stepTemplates, stepToTemplate(step, plan, value)],
        }));
      },
    });
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
      ask({
        kind: 'confirm',
        title: 'Import failed',
        message: 'Could not import: not a valid plan file.',
        confirmLabel: 'OK',
        info: true,
        onConfirm: () => undefined,
      });
    }
  }

  function resetToSample() {
    ask({
      kind: 'confirm',
      title: 'Replace plan',
      message: 'Replace the current plan with the sample plan?',
      confirmLabel: 'Replace',
      danger: true,
      onConfirm: () => updatePlan({ ...samplePlan(), resources: workspace.resources }),
    });
  }

  const activeSaved: SavedWorkspacePlan | undefined = activeSavedPlan(workspace);

  return (
    <div className="app">
      <header className="app-header">
        <span className="header-title">
          {workspace.name}: {plan.name || 'Unnamed plan'}
        </span>
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

      <div className="app-body">
      <WorkspacePanel
        expanded={panelExpanded}
        workspaces={workspaceState.workspaces.map((item) => ({ id: item.id, name: item.name }))}
        selectedWorkspaceId={workspace.id}
        plans={workspace.plans.map((saved) => ({ id: saved.id, name: saved.name }))}
        selectedPlanId={activeSaved?.id ?? ''}
        onToggle={() => setPanelExpanded((value) => !value)}
        onSelectWorkspace={changeWorkspace}
        onNewWorkspace={createNewWorkspace}
        onRenameWorkspace={renameWorkspace}
        onDeleteWorkspace={deleteWorkspace}
        onSelectPlan={loadPlanById}
        onNewPlan={createPlan}
        onRenamePlan={renamePlan}
        onDeletePlan={deletePlan}
      />
      <main>
        <div className="left-col">
          <ResourcePanel plan={plan} onChange={updatePlan} ask={ask} />
          <LibraryPanel
            plan={plan}
            stepTemplates={workspace.stepTemplates}
            planTemplates={workspace.planTemplates}
            onChange={(nextPlan) => updatePlan({ ...nextPlan, resources: mergeResources(workspace.resources, nextPlan.resources) })}
            onStepTemplates={(templates) => updateActiveWorkspace((current) => ({ ...current, stepTemplates: templates }))}
            onPlanTemplates={(templates) => updateActiveWorkspace((current) => ({ ...current, planTemplates: templates }))}
            ask={ask}
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

      {dialog && <Modal key={dialogKey.current} request={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function mergeResources(current: Plan['resources'], incoming: Plan['resources']): Plan['resources'] {
  const byId = new Map(current.map((resource) => [resource.id, resource]));
  for (const resource of incoming) byId.set(resource.id, resource);
  return [...byId.values()];
}
