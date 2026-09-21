import type { Plan, PortKind, PortRef } from './types';
import { newId } from './types';

function samePort(left: PortRef, right: PortRef): boolean {
  return left.stepId === right.stepId && left.kind === right.kind && left.index === right.index;
}

function portAmounts(plan: Plan, port: PortRef) {
  const step = plan.steps.find((candidate) => candidate.id === port.stepId);
  if (!step) return undefined;
  return port.kind === 'input' ? step.inputs : step.outputs;
}

export function connectPorts(plan: Plan, from: PortRef, to: PortRef, resourceId: string): Plan {
  if (from.stepId === to.stepId || from.kind === to.kind) return plan;
  if (!portAmounts(plan, from)?.[from.index] || !portAmounts(plan, to)?.[to.index]) return plan;

  const links = plan.links ?? [];
  const alreadyLinked = links.some(
    (link) => samePort(link.from, from) && samePort(link.to, to),
  );
  const nextLinks = alreadyLinked ? links : [...links, { id: newId(), from, to }];
  const steps = plan.steps.map((step) => {
    if (step.id !== to.stepId) return step;
    const amounts = to.kind === 'input' ? step.inputs : step.outputs;
    const nextAmounts = amounts.map((amount, index) =>
      index === to.index ? { ...amount, resourceId } : amount,
    );
    return to.kind === 'input'
      ? { ...step, inputs: nextAmounts }
      : { ...step, outputs: nextAmounts };
  });
  return { ...plan, steps, links: nextLinks };
}

export function removePortAndLinks(
  plan: Plan,
  stepId: string,
  kind: PortKind,
  index: number,
): Plan {
  const steps = plan.steps.map((step) => {
    if (step.id !== stepId) return step;
    return kind === 'input'
      ? { ...step, inputs: step.inputs.filter((_, i) => i !== index) }
      : { ...step, outputs: step.outputs.filter((_, i) => i !== index) };
  });
  const links = (plan.links ?? [])
    .filter(
      (link) =>
        !samePort(link.from, { stepId, kind, index }) &&
        !samePort(link.to, { stepId, kind, index }),
    )
    .map((link) => ({
      ...link,
      from: shiftPort(link.from, stepId, kind, index),
      to: shiftPort(link.to, stepId, kind, index),
    }));
  return { ...plan, steps, links };
}

export function removeStepAndLinks(plan: Plan, stepId: string): Plan {
  return {
    ...plan,
    steps: plan.steps.filter((step) => step.id !== stepId),
    links: (plan.links ?? []).filter(
      (link) => link.from.stepId !== stepId && link.to.stepId !== stepId,
    ),
  };
}

export function removeResourceAndLinks(plan: Plan, resourceId: string): Plan {
  const removed = new Map<string, number[]>();
  const steps = plan.steps.map((step) => {
    const inputIndexes = step.inputs.flatMap((amount, index) =>
      amount.resourceId === resourceId ? [index] : [],
    );
    const outputIndexes = step.outputs.flatMap((amount, index) =>
      amount.resourceId === resourceId ? [index] : [],
    );
    if (inputIndexes.length) removed.set(`${step.id}:input`, inputIndexes);
    if (outputIndexes.length) removed.set(`${step.id}:output`, outputIndexes);
    return {
      ...step,
      inputs: step.inputs.filter((amount) => amount.resourceId !== resourceId),
      outputs: step.outputs.filter((amount) => amount.resourceId !== resourceId),
    };
  });
  const links = (plan.links ?? [])
    .map((link) => ({
      ...link,
      from: remapPort(link.from, removed),
      to: remapPort(link.to, removed),
    }))
    .filter((link): link is typeof link & { from: PortRef; to: PortRef } =>
      link.from !== undefined && link.to !== undefined,
    );
  return { ...plan, steps, links };
}

function remapPort(port: PortRef, removed: Map<string, number[]>): PortRef | undefined {
  const indexes = removed.get(`${port.stepId}:${port.kind}`) ?? [];
  if (indexes.includes(port.index)) return undefined;
  const shift = indexes.filter((index) => index < port.index).length;
  return shift === 0 ? port : { ...port, index: port.index - shift };
}

function shiftPort(port: PortRef, stepId: string, kind: PortKind, removedIndex: number): PortRef {
  if (port.stepId !== stepId || port.kind !== kind || port.index < removedIndex) return port;
  return { ...port, index: port.index - 1 };
}
