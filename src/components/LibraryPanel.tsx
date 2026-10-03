import type { Plan } from '../model/types';
import type { PlanTemplate, StepTemplate, TemplateAmount } from '../model/templates';
import { instantiatePlanTemplate, instantiateStepTemplate } from '../model/templates';
import { newId } from '../model/types';
import type { Ask } from './Modal';

/** Tooltip describing what a step template consumes and produces. */
function templateSummary(t: StepTemplate): string {
  const fmt = (a: TemplateAmount) => `${a.amount} ${a.resourceName}`;
  return `${t.inputs.map(fmt).join(', ')} → ${t.outputs.map(fmt).join(', ')}`;
}

/** Remove the item with the given id (used when deleting a template row). */
function withoutId<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

interface TemplateRowProps {
  name: string;
  tooltip?: string;
  actionLabel: string;
  onAction: () => void;
  onDelete: () => void;
}

function TemplateRow({ name, tooltip, actionLabel, onAction, onDelete }: TemplateRowProps) {
  return (
    <li className="template-row">
      <span className="template-name" title={tooltip}>
        {name}
      </span>
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
      <button type="button" className="icon danger" title="Delete template" onClick={onDelete}>
        ×
      </button>
    </li>
  );
}

interface Props {
  plan: Plan;
  stepTemplates: StepTemplate[];
  planTemplates: PlanTemplate[];
  onChange: (plan: Plan) => void;
  onStepTemplates: (t: StepTemplate[]) => void;
  onPlanTemplates: (t: PlanTemplate[]) => void;
  ask: Ask;
}

/** Reusable building blocks: step templates (insert into any plan) and plan
 *  templates (named starting points). Saved steps appear here via ☆ on a card. */
export function LibraryPanel({
  plan,
  stepTemplates,
  planTemplates,
  onChange,
  onStepTemplates,
  onPlanTemplates,
  ask,
}: Props) {
  function saveCurrentPlan() {
    ask({
      kind: 'prompt',
      title: 'Save plan template',
      label: 'Template name',
      initial: plan.name,
      confirmLabel: 'Save',
      onConfirm: (value) => {
        onPlanTemplates([
          ...planTemplates,
          { id: newId(), name: value.trim() || plan.name || 'Unnamed plan', plan: structuredClone(plan) },
        ]);
      },
    });
  }

  function loadPlanTemplate(tpl: PlanTemplate) {
    ask({
      kind: 'confirm',
      title: 'Load plan template',
      message: `Replace the current plan with "${tpl.name}"?`,
      confirmLabel: 'Replace',
      danger: true,
      onConfirm: () => onChange(instantiatePlanTemplate(tpl)),
    });
  }

  return (
    <section className="panel">
      <h2>Library</h2>

      <h3>Step templates</h3>
      {stepTemplates.length === 0 && (
        <p className="empty-hint">
          Save any step with <b>☆</b> on its card, then insert copies here — even into other plans.
        </p>
      )}
      <ul className="template-list">
        {stepTemplates.map((t) => (
          <TemplateRow
            key={t.id}
            name={t.name}
            tooltip={templateSummary(t)}
            actionLabel="Insert"
            onAction={() => onChange(instantiateStepTemplate(plan, t))}
            onDelete={() => onStepTemplates(withoutId(stepTemplates, t.id))}
          />
        ))}
      </ul>

      <h3>Plan templates</h3>
      <button type="button" onClick={saveCurrentPlan}>
        Save current plan
      </button>
      <ul className="template-list">
        {planTemplates.map((t) => (
          <TemplateRow
            key={t.id}
            name={t.name}
            actionLabel="Load"
            onAction={() => loadPlanTemplate(t)}
            onDelete={() => onPlanTemplates(withoutId(planTemplates, t.id))}
          />
        ))}
      </ul>
    </section>
  );
}
