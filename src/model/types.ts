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

export interface ProcessStep {
  id: string;
  name: string;
  inputs: ResourceAmount[];
  outputs: ResourceAmount[];
  /** How long one run takes; needed for station counting (P2). */
  durationSeconds?: number;
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
}

export function newId(): string {
  return crypto.randomUUID();
}
