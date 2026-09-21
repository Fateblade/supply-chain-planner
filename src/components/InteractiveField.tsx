import { useRef } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import type { Plan, PortKind, ProcessStep, StepLink } from '../model/types';

interface Props {
  plan: Plan;
  selectedStepId?: string;
  onSelect: (stepId: string) => void;
  onMove: (stepId: string, x: number, y: number) => void;
  onAddStep: (x: number, y: number) => void;
  onConnect: (
    sourceStepId: string,
    sourceKind: PortKind,
    sourceIndex: number,
    resourceId: string,
    targetStepId: string,
    targetKind: PortKind,
    targetIndex?: number,
  ) => void;
}

const NODE_WIDTH = 190;
const NODE_HEIGHT = 120;
const PORT_TOP = 52;
const PORT_GAP = 29;

type DragPayload =
  | { type: 'resource'; stepId: string; kind: PortKind; index: number; resourceId: string }
  | { type: 'step'; stepId: string };

function defaultPosition(index: number): { x: number; y: number } {
  return {
    x: 150 + (index % 3) * 260,
    y: 120 + Math.floor(index / 3) * 190,
  };
}

function resourceName(plan: Plan, resourceId: string): string {
  return plan.resources.find((resource) => resource.id === resourceId)?.name ?? 'Unknown resource';
}

function dragPayload(event: DragEvent<HTMLElement>): DragPayload | null {
  try {
    return JSON.parse(event.dataTransfer.getData('application/json')) as DragPayload;
  } catch {
    return null;
  }
}

function portPoint(
  step: ProcessStep,
  index: number,
  kind: PortKind,
  stepIndex: number,
): { x: number; y: number } {
  const position = step.position ?? defaultPosition(stepIndex);
  return {
    x: position.x + (kind === 'output' ? NODE_WIDTH / 2 : -NODE_WIDTH / 2),
    y: position.y - NODE_HEIGHT / 2 + PORT_TOP + index * PORT_GAP,
  };
}

function linkPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const direction = to.x >= from.x ? 1 : -1;
  const curve = Math.max(40, Math.abs(to.x - from.x) * 0.45);
  return `M ${from.x} ${from.y} C ${from.x + curve * direction} ${from.y}, ${to.x - curve * direction} ${to.y}, ${to.x} ${to.y}`;
}

function StepNode({
  plan,
  step,
  index,
  selected,
  onSelect,
  onMove,
  onConnect,
}: {
  plan: Plan;
  step: ProcessStep;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onConnect: Props['onConnect'];
}) {
  const position = step.position ?? defaultPosition(index);
  const nodeDragStarted = useRef(false);

  function startDrag(event: DragEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    nodeDragStarted.current = true;
    event.dataTransfer.setData('application/json', JSON.stringify({ type: 'step', stepId: step.id }));
    event.dataTransfer.effectAllowed = 'move';
  }

  function finishDrag(event: DragEvent<HTMLDivElement>) {
    if (!nodeDragStarted.current) return;
    nodeDragStarted.current = false;
    const field = event.currentTarget.parentElement;
    if (!field) return;
    const bounds = field.getBoundingClientRect();
    onMove(
      Math.max(NODE_WIDTH / 2, event.clientX - bounds.left),
      Math.max(NODE_HEIGHT / 2, event.clientY - bounds.top),
    );
  }

  function startHandleDrag(
    event: DragEvent<HTMLDivElement>,
    kind: PortKind,
    index: number,
    resourceId: string,
  ) {
    event.stopPropagation();
    nodeDragStarted.current = false;
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({ type: 'resource', stepId: step.id, kind, index, resourceId }),
    );
    event.dataTransfer.effectAllowed = 'copy';
  }

  function connectToTarget(
    event: DragEvent<HTMLDivElement>,
    targetKind: PortKind,
    targetIndex?: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragPayload(event);
    if (payload?.type !== 'resource' || payload.stepId === step.id) return;
    if (payload.kind === targetKind) return;
    onConnect(
      payload.stepId,
      payload.kind,
      payload.index,
      payload.resourceId,
      step.id,
      targetKind,
      targetIndex,
    );
  }

  function renderHandle(kind: PortKind, resourceId: string, index: number) {
    const isInput = kind === 'input';
    return (
      <div
        className={`field-handle ${isInput ? 'input-handle' : 'output-handle'}`}
        key={`${resourceId}-${index}`}
        draggable
        onDragStart={(event) => startHandleDrag(event, kind, index, resourceId)}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(event) => connectToTarget(event, kind, index)}
        title={`${isInput ? 'Input' : 'Output'}: ${resourceName(plan, resourceId)} · drag to connect`}
      >
        {isInput ? <span>{resourceName(plan, resourceId)}</span> : <b>{resourceName(plan, resourceId)}</b>}
        <b>{isInput ? step.inputs[index].amount : step.outputs[index].amount}</b>
      </div>
    );
  }

  return (
    <div
      className={`field-step ${selected ? 'selected' : ''}`}
      style={{ left: position.x, top: position.y }}
      draggable
      onClick={onSelect}
      onDragStart={startDrag}
      onDragEnd={finishDrag}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(event) => {
        const payload = dragPayload(event);
        if (payload?.type === 'resource') {
          connectToTarget(event, payload.kind === 'output' ? 'input' : 'output');
        }
      }}
      title="Click to configure · drag to move"
    >
      <div className="field-step-title">{step.name || 'Unnamed step'}</div>
      <div className="field-step-body">
        <div className="field-handles input-handles">
          {step.inputs.map((input, inputIndex) => renderHandle('input', input.resourceId, inputIndex))}
        </div>
        <div className="field-arrow">→</div>
        <div className="field-handles output-handles">
          {step.outputs.map((output, outputIndex) => renderHandle('output', output.resourceId, outputIndex))}
        </div>
      </div>
    </div>
  );
}

function LinkLines({ plan }: { plan: Plan }) {
  const links = plan.links ?? [];
  return (
    <svg className="field-links" width="1040" height="760" aria-hidden="true">
      {links.map((link: StepLink) => {
        const fromStepIndex = plan.steps.findIndex((step) => step.id === link.from.stepId);
        const toStepIndex = plan.steps.findIndex((step) => step.id === link.to.stepId);
        const fromStep = plan.steps[fromStepIndex];
        const toStep = plan.steps[toStepIndex];
        if (!fromStep || !toStep) return null;
        const from = portPoint(fromStep, link.from.index, link.from.kind, fromStepIndex);
        const to = portPoint(toStep, link.to.index, link.to.kind, toStepIndex);
        return <path key={link.id} d={linkPath(from, to)} />;
      })}
    </svg>
  );
}

export function InteractiveField({
  plan,
  selectedStepId,
  onSelect,
  onMove,
  onAddStep,
  onConnect,
}: Props) {
  function addOnDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    onAddStep(event.clientX - bounds.left, event.clientY - bounds.top);
  }

  return (
    <section className="field-panel">
      <div className="field-toolbar">
        <div>
          <h2>Planning field</h2>
          <p>Double-click to add a step · drag nodes to arrange · drag handles to connect</p>
        </div>
        <span className="field-count">{plan.steps.length} steps</span>
      </div>
      <div className="field-scroll">
        <div className="field-canvas" onDoubleClick={addOnDoubleClick}>
          <LinkLines plan={plan} />
          {plan.steps.map((step, index) => (
            <StepNode
              key={step.id}
              plan={plan}
              step={step}
              index={index}
              selected={step.id === selectedStepId}
              onSelect={() => onSelect(step.id)}
              onMove={(x, y) => onMove(step.id, x, y)}
              onConnect={onConnect}
            />
          ))}
          {plan.steps.length === 0 && (
            <div className="field-empty">Double-click anywhere to add your first process step.</div>
          )}
        </div>
      </div>
    </section>
  );
}
