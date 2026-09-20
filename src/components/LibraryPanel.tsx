import type { Plan } from '../model/types';
import type { PlanTemplate, StepTemplate } from '../model/templates';
import { instantiatePlanTemplate, instantiateStepTemplate } from '../model/templates';
import { newId } from '../model/types';

interface Props {
  plan: Plan;
  stepTemplates: StepTemplate[];
  planTemplates: PlanTemplate[];
  onChange: (plan: Plan) => void;
  onStepTemplates: (t: StepTemplate[]) => void;
  onPlanTemplates: (t: PlanTemplate[]) => void;
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
}: Props) {
  function saveCurrentPlan() {
    const name = prompt('Plan template name:', plan.name);
    if (name === null) return;
    onPlanTemplates([
      ...planTemplates,
      { id: newId(), name: name.trim() || plan.name || 'Unnamed plan', plan: structuredClone(plan) },
    ]);
  }

  function loadPlanTemplate(tpl: PlanTemplate) {
    if (confirm(`Replace the current plan with "${tpl.name}"?`)) {
      onChange(instantiatePlanTemplate(tpl));
    }
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
          <li key={t.id} className="template-row">
            <span className="template-name" title={`${t.inputs.map((a) => `${a.amount} ${a.resourceName}`).join(', ')} → ${t.outputs.map((a) => `${a.amount} ${a.resourceName}`).join(', ')}`}>
              {t.name}
            </span>
            <button type="button" onClick={() => onChange(instantiateStepTemplate(plan, t))}>
              Insert
            </button>
            <button
              type="button"
              className="icon danger"
              title="Delete template"
              onClick={() => onStepTemplates(stepTemplates.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <h3>Plan templates</h3>
      <button type="button" onClick={saveCurrentPlan}>
        Save current plan
      </button>
      <ul className="template-list">
        {planTemplates.map((t) => (
          <li key={t.id} className="template-row">
            <span className="template-name">{t.name}</span>
            <button type="button" onClick={() => loadPlanTemplate(t)}>
              Load
            </button>
            <button
              type="button"
              className="icon danger"
              title="Delete template"
              onClick={() => onPlanTemplates(planTemplates.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
