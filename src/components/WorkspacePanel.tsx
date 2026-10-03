import { useEffect, useRef } from 'react';

/** Shared between the collapsed strip, the toggle button, and the panel body. */
const PANEL_BODY_ID = 'workspace-panel-body';

interface PlanEntry {
  id: string;
  name: string;
}

interface Props {
  expanded: boolean;
  workspaces: PlanEntry[];
  selectedWorkspaceId: string;
  plans: PlanEntry[];
  selectedPlanId: string;
  onToggle: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onNewWorkspace: () => void;
  onRenameWorkspace: () => void;
  onDeleteWorkspace: () => void;
  onSelectPlan: (planId: string) => void;
  onNewPlan: () => void;
  onRenamePlan: () => void;
  onDeletePlan: () => void;
}

/** Collapsible left sidepanel for workspace and plan management.
 *  Collapsed by default; the header shows the current workspace/plan names. */
export function WorkspacePanel({
  expanded,
  workspaces,
  selectedWorkspaceId,
  plans,
  selectedPlanId,
  onToggle,
  onSelectWorkspace,
  onNewWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onSelectPlan,
  onNewPlan,
  onRenamePlan,
  onDeletePlan,
}: Props) {
  const stripRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);

  // Keep keyboard focus on the visible toggle when the panel expands/collapses.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    (expanded ? titleRef.current : stripRef.current)?.focus();
  }, [expanded]);

  if (!expanded) {
    return (
      <button
        ref={stripRef}
        type="button"
        className="workspace-strip"
        onClick={onToggle}
        title="Expand workspaces and plans"
        aria-label="Expand workspaces and plans"
        aria-expanded="false"
        aria-controls={PANEL_BODY_ID}
      >
        <span className="strip-label">Workspaces</span>
        <span className="strip-indicator">›</span>
        <span className="strip-label">Plans</span>
      </button>
    );
  }

  return (
    <section className="workspace-panel" id={PANEL_BODY_ID}>
      <button
        ref={titleRef}
        type="button"
        className="panel-title"
        onClick={onToggle}
        title="Collapse panel (‹)"
        aria-label="Collapse workspaces panel"
        aria-expanded="true"
        aria-controls={PANEL_BODY_ID}
      >
        <span>Workspaces</span>
        <span className="collapse-hint" aria-hidden="true">‹</span>
      </button>
      <div className="panel-row">
        <select
          value={selectedWorkspaceId}
          onChange={(event) => onSelectWorkspace(event.target.value)}
          title="Active workspace"
          aria-label="Active workspace"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        <button type="button" className="icon" onClick={onNewWorkspace} title="New workspace">+</button>
        <button type="button" className="icon" onClick={onRenameWorkspace} title="Rename workspace">R</button>
        <button type="button" className="icon danger" onClick={onDeleteWorkspace} title="Delete workspace">D</button>
      </div>

      <div className="panel-splitter" aria-hidden="true" />

      <h3 className="plans-title">Plans</h3>

      <ul className="plan-list">
        {plans.map((plan) => (
          <li key={plan.id}>
            <button
              type="button"
              className={`plan-item ${plan.id === selectedPlanId ? 'selected' : ''}`}
              title={`Open plan “${plan.name || 'Unnamed plan'}”`}
              onClick={() => onSelectPlan(plan.id)}
            >
              {plan.name || 'Unnamed plan'}
            </button>
          </li>
        ))}
      </ul>

      <div className="panel-row bottom">
        <button type="button" className="icon" onClick={onNewPlan} title="New plan">+</button>
        <button type="button" className="icon" onClick={onRenamePlan} title="Rename selected plan">R</button>
        <button type="button" className="icon danger" onClick={onDeletePlan} title="Delete selected plan">D</button>
      </div>
    </section>
  );
}
