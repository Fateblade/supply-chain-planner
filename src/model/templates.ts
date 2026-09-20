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
    inputs: step.inputs.map((a) => ({ resourceName: nameOf(a.resourceId), amount: a.amount })),
    outputs: step.outputs.map((a) => ({ resourceName: nameOf(a.resourceId), amount: a.amount })),
  };
}

/** Insert a fresh copy of a template into the plan, resolving resources by
 *  name (case-insensitive) and creating any that don't exist yet. */
export function instantiateStepTemplate(plan: Plan, tpl: StepTemplate): Plan {
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
    inputs: tpl.inputs.map((a) => ({ resourceId: resolve(a.resourceName), amount: a.amount })),
    outputs: tpl.outputs.map((a) => ({ resourceId: resolve(a.resourceName), amount: a.amount })),
  };
  return { ...plan, resources, steps: [...plan.steps, step] };
}

/** Fresh deep copy of a plan template's plan so editing never mutates the library. */
export function instantiatePlanTemplate(tpl: PlanTemplate): Plan {
  return structuredClone(tpl.plan);
}
