import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan, ProcessStep } from './model/types';
import { newId } from './model/types';
import { connectPorts, removeStepAndLinks } from './model/links';
import { solvePlan } from './model/solver';
import { samplePlan } from './model/sample';
import { instantiateStepTemplate, isStepInLibrary, stepToTemplate, templateSummary } from './model/templates';
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
import { autoLayout } from './model/layout';
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

  /** Open a modal dialog (see Modal). Only one dialog is open at a time, and the
   *  previous one always unmounts first, so each Modal mounts fresh. */
  function ask(request: DialogRequest) {
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

  function clearSelection() {
    setSelectedStepId(undefined);
  }

  /** Prompt dialog: request a text value, then continue with it. */
  function askPrompt(
    options: Omit<Extract<DialogRequest, { kind: 'prompt' }>, 'kind' | 'onConfirm'>,
    onConfirm: (value: string) => void,
  ) {
    ask({ ...options, kind: 'prompt', onConfirm });
  }

  /** Confirm dialog: show a message, then continue if accepted. */
  function askConfirm(
    options: Omit<Extract<DialogRequest, { kind: 'confirm' }>, 'kind' | 'onConfirm'>,
    onConfirm: () => void,
  ) {
    ask({ ...options, kind: 'confirm', onConfirm });
  }

  /** Informational dialog with a single dismiss action. */
  function askInfo(title: string, message: string) {
    askConfirm({ title, message, confirmLabel: 'OK', info: true }, () => undefined);
  }

  function changeWorkspace(workspaceId: string) {
    setWorkspaceState((state) => ({ ...state, activeWorkspaceId: workspaceId }));
    clearSelection();
  }

  function createNewWorkspace() {
    askPrompt(
      { title: 'New workspace', label: 'Workspace name', confirmLabel: 'Create' },
      (value) => {
        const created = createWorkspace(value.trim(), { ...samplePlan(), name: 'Plan 1' });
        setWorkspaceState((state) => ({
          workspaces: [...state.workspaces, created],
          activeWorkspaceId: created.id,
        }));
        clearSelection();
      },
    );
  }

  function renameWorkspace() {
    askPrompt(
      { title: 'Rename workspace', label: 'Workspace name', initial: workspace.name, confirmLabel: 'Rename' },
      (value) => updateActiveWorkspace((current) => ({ ...current, name: value.trim() })),
    );
  }

  function deleteWorkspace() {
    askConfirm(
      {
        title: 'Delete workspace',
        message: `Delete workspace “${workspace.name}” and all its plans and libraries? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      },
      () => {
        setWorkspaceState((state) => {
          const remaining = state.workspaces.filter((item) => item.id !== workspace.id);
          return { ...state, workspaces: remaining, activeWorkspaceId: remaining[0].id };
        });
        clearSelection();
      },
    );
  }

  function createPlan() {
    askPrompt(
      { title: 'New plan', label: 'Plan name', initial: `Plan ${workspace.plans.length + 1}`, confirmLabel: 'Create' },
      (value) => {
        updateActiveWorkspace((current) => makePlanInWorkspace(current, value.trim()));
        clearSelection();
      },
    );
  }

  function selectPlan(planId: string) {
    if (!workspace.plans.some((item) => item.id === planId)) return;
    updateActiveWorkspace((current) => ({ ...current, activePlanId: planId }));
    clearSelection();
  }

  function renamePlan() {
    askPrompt(
      { title: 'Rename plan', label: 'Plan name', initial: plan.name, confirmLabel: 'Rename' },
      (value) => updatePlan({ ...plan, name: value.trim() }),
    );
  }

  function deletePlan() {
    askConfirm(
      {
        title: 'Delete plan',
        message: `Delete plan “${plan.name || 'Unnamed plan'}”? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      },
      () => {
        updateActiveWorkspace((current) => {
          const plans = current.plans.filter((saved) => saved.id !== current.activePlanId);
          return { ...current, plans, activePlanId: plans[0].id };
        });
        clearSelection();
      },
    );
  }

  function saveStepAsTemplate(step: ProcessStep) {
    askPrompt(
      { title: 'Save step template', label: 'Template name', initial: step.name || 'Unnamed step', confirmLabel: 'Save' },
      (value) => {
        updateActiveWorkspace((current) => ({
          ...current,
          stepTemplates: [...current.stepTemplates, stepToTemplate(step, plan, value)],
        }));
      },
    );
  }

  function requestDeleteStep() {
    if (!selectedStep) return;
    ask({
      kind: 'confirm',
      title: 'Delete step',
      message: `Delete step “${selectedStep.name || 'Unnamed step'}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => updatePlan(removeStepAndLinks(plan, selectedStep.id)),
    });
  }

  // Delete key removes the selected step, unless the user is typing
  // in a field where Delete edits text.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete' || !selectedStep) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      requestDeleteStep();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Re-subscribe when the captured plan/step change so onConfirm sees
    // fresh state.
  }, [selectedStep, plan]);

  function addStepAt(x: number, y: number) {
    const step = { id: newId(), name: '', inputs: [], outputs: [], position: { x, y } };
    updatePlan({ ...plan, steps: [...plan.steps, step] });
    setSelectedStepId(step.id);
  }

  function createProducer(resourceId: string) {
    const resource = plan.resources.find((r) => r.id === resourceId);
    if (!resource) return;
    // Place the new producing step one row below the step that needs it.
    const position = { x: selectedStep?.position?.x ?? 150, y: (selectedStep?.position?.y ?? 120) + 190 };
    const step = {
      id: newId(),
      name: resource.name,
      inputs: [],
      outputs: [{ resourceId: resource.id, amount: 1 }],
      position,
    };
    updatePlan({ ...plan, steps: [...plan.steps, step] });
    setSelectedStepId(step.id);
  }

  function offerProducers(resourceId: string, stepId: string, inputIndex: number) {
    const resource = plan.resources.find((r) => r.id === resourceId);
    if (!resource) return;
    const matches = workspace.stepTemplates.filter((t) =>
      t.outputs.some((o) => o.resourceName.toLowerCase() === resource.name.toLowerCase()),
    );
    if (matches.length === 0) {
      askInfo(
        'No library steps',
        `No step template makes “${resource.name}”. Save one with ☆ on its card first.`,
      );
      return;
    }
    const source = plan.steps.find((s) => s.id === stepId);
    const position = { x: source?.position?.x ?? 150, y: (source?.position?.y ?? 120) + 190 };
    ask({
      kind: 'choice',
      title: `Steps that make “${resource.name}”`,
      message: 'Insert a copy from the library?',
      options: matches.map((t) => ({ id: t.id, label: t.name, detail: templateSummary(t) })),
      onSelect: (tplId) => {
        const tpl = matches.find((t) => t.id === tplId);
        if (!tpl) return;
        const next = instantiateStepTemplate(plan, tpl, position);
        const newStep = next.steps[next.steps.length - 1];
        // Auto-connect the new step's matching output to the clicked input.
        const outIndex = newStep.outputs.findIndex((o) => o.resourceId === resource.id);
        const linked =
          outIndex >= 0
            ? connectPorts(
                next,
                { stepId: newStep.id, kind: 'output', index: outIndex },
                { stepId, kind: 'input', index: inputIndex },
                resource.id,
              )
            : next;
        updatePlan(linked);
        setSelectedStepId(newStep.id);
      },
    });
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
      askInfo('Import failed', 'Could not import: not a valid plan file.');
    }
  }

  function resetToSample() {
    askConfirm(
      { title: 'Replace plan', message: 'Replace the current plan with the sample plan?', confirmLabel: 'Replace', danger: true },
      () => updatePlan({ ...samplePlan(), resources: workspace.resources }),
    );
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
        deleteWorkspaceReason={
          workspaceState.workspaces.length <= 1 ? 'Cannot delete the last workspace.' : undefined
        }
        onSelectPlan={selectPlan}
        onNewPlan={createPlan}
        onRenamePlan={renamePlan}
        onDeletePlan={deletePlan}
        deletePlanReason={workspace.plans.length <= 1 ? 'Cannot delete the last plan in a workspace.' : undefined}
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
          onCreateProducer={createProducer}
          onOfferProducers={offerProducers}
          onAutoLayout={() => updatePlan(autoLayout(plan))}
          onConnect={connectSteps}
        />
        <aside className="right-col">
          {selectedStep ? (
            <section className="panel selected-step-panel">
              <div className="sidebar-heading">
                <h2>Selected step</h2>
                <button type="button" className="bare" title="Deselect step" onClick={clearSelection}>×</button>
              </div>
              <StepCard
                key={selectedStep.id}
                plan={plan}
                step={selectedStep}
                onChange={updatePlan}
                onSaveTemplate={saveStepAsTemplate}
                inLibrary={isStepInLibrary(selectedStep, plan, workspace.stepTemplates)}
                onDelete={requestDeleteStep}
              />
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

      {dialog && <Modal request={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function mergeResources(current: Plan['resources'], incoming: Plan['resources']): Plan['resources'] {
  const byId = new Map(current.map((resource) => [resource.id, resource]));
  for (const resource of incoming) byId.set(resource.id, resource);
  return [...byId.values()];
}
