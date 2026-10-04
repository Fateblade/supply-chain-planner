import type { Plan, ProcessStep } from './types';
import { newId } from './types';

export interface TemplateAmount {
  resourceName: string;
  amount: number;
}

/**
 * A reusable step stored by resource *name* (not id) so it can be inserted
 * into any plan — missing resources are created on insert.
 */
export interface StepTemplate {
  id: string;
  name: string;
  durationSeconds?: number;
  note?: string;
  inputs: TemplateAmount[];
  outputs: TemplateAmount[];
}

/** A whole plan saved as a named starting point. */
export interface PlanTemplate {
  id: string;
  name: string;
  plan: Plan;
}

export function stepToTemplate(step: ProcessStep, plan: Plan, name?: string): StepTemplate {
  const nameOf = (rid: string) => plan.resources.find((r) => r.id === rid)?.name ?? rid;
  return {
    id: newId(),
    name: name?.trim() || step.name || 'Unnamed step',
    durationSeconds: step.durationSeconds,
    note: step.note,
    inputs: step.inputs.map((a) => ({ resourceName: nameOf(a.resourceId), amount: a.amount })),
    outputs: step.outputs.map((a) => ({ resourceName: nameOf(a.resourceId), amount: a.amount })),
  };
}

/** Tooltip describing what a step template consumes and produces. */
export function templateSummary(t: StepTemplate): string {
  const fmt = (a: TemplateAmount) => `${a.amount} ${a.resourceName}`;
  return `${t.inputs.map(fmt).join(', ')} → ${t.outputs.map(fmt).join(', ')}`;
}

/** Whether an identical copy of the step is already saved in the library. */
export function isStepInLibrary(step: ProcessStep, plan: Plan, templates: StepTemplate[]): boolean {
  const ref = stepToTemplate(step, plan);
  const same = (a: TemplateAmount[], b: TemplateAmount[]) =>
    a.length === b.length &&
    a.every((x, i) => x.resourceName === b[i].resourceName && x.amount === b[i].amount);
  return templates.some(
    (t) =>
      t.name === ref.name &&
      t.durationSeconds === ref.durationSeconds &&
      t.note === ref.note &&
      same(t.inputs, ref.inputs) &&
      same(t.outputs, ref.outputs),
  );
}

/** Insert a fresh copy of a template into the plan, resolving resources by
 *  name (case-insensitive) and creating any that don't exist yet. */
export function instantiateStepTemplate(
  plan: Plan,
  tpl: StepTemplate,
  position?: { x: number; y: number },
): Plan {
  const resources = [...plan.resources];
  const byName = new Map(resources.map((r) => [r.name.toLowerCase(), r.id]));
  const resolve = (name: string): string => {
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing) return existing;
    const id = newId();
    resources.push({ id, name, isRaw: false });
    byName.set(key, id);
    return id;
  };
  const step: ProcessStep = {
    id: newId(),
    name: tpl.name,
    durationSeconds: tpl.durationSeconds,
    note: tpl.note,
    inputs: tpl.inputs.map((a) => ({ resourceId: resolve(a.resourceName), amount: a.amount })),
    outputs: tpl.outputs.map((a) => ({ resourceId: resolve(a.resourceName), amount: a.amount })),
    position,
  };
  return { ...plan, resources, steps: [...plan.steps, step] };
}

/** Fresh deep copy of a plan template's plan so editing never mutates the library. */
export function instantiatePlanTemplate(tpl: PlanTemplate): Plan {
  return structuredClone(tpl.plan);
}
