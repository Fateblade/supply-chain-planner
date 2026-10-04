export interface Resource {
  id: string;
  name: string;
  /** Raw resources are supplied from outside the plan (mined, bought, ...). */
  isRaw: boolean;
}

export interface ResourceAmount {
  resourceId: string;
  amount: number;
}

export type PortKind = 'input' | 'output';

export interface PortRef {
  stepId: string;
  kind: PortKind;
  index: number;
}

export interface StepLink {
  id: string;
  from: PortRef;
  to: PortRef;
}

export interface ProcessStep {
  id: string;
  name: string;
  inputs: ResourceAmount[];
  outputs: ResourceAmount[];
  /** How long one run takes; needed for station counting (P2). */
  durationSeconds?: number;
  /** Free-form remark shown on the field node and editable on the card. */
  note?: string;
  /** Position on the interactive planning field. Older plans may omit it. */
  position?: { x: number; y: number };
}

/** A target marks a resource as "final": the plan must deliver this much of it. */
export interface Target {
  resourceId: string;
  amount: number;
  /** Time frame in seconds (60 = per minute, 3600 = per hour).
   *  Undefined means a one-off total with no rate requirement. */
  perSeconds?: number;
}

export interface Plan {
  name: string;
  resources: Resource[];
  steps: ProcessStep[];
  targets: Target[];
  /** Optional for backwards compatibility with plans created before links. */
  links?: StepLink[];
}

export function newId(): string {
  return crypto.randomUUID();
}
