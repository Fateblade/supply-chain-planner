import type { DragEvent, MouseEvent } from 'react';
import type { Plan, ProcessStep } from '../model/types';

interface Props {
  plan: Plan;
  selectedStepId?: string;
  onSelect: (stepId: string) => void;
  onMove: (stepId: string, x: number, y: number) => void;
  onAddStep: (x: number, y: number) => void;
  onConnect: (
    sourceStepId: string,
    sourceKind: 'input' | 'output',
    resourceId: string,
    targetStepId: string,
  ) => void;
}

const NODE_WIDTH = 190;
const NODE_HEIGHT = 120;

function defaultPosition(index: number): { x: number; y: number } {
  return {
    x: 150 + (index % 3) * 260,
    y: 120 + Math.floor(index / 3) * 190,
  };
}

function resourceName(plan: Plan, resourceId: string): string {
  return plan.resources.find((resource) => resource.id === resourceId)?.name ?? 'Unknown resource';
}

function dragPayload(event: DragEvent<HTMLElement>):
  | { type: 'resource'; stepId: string; kind: 'input' | 'output'; resourceId: string }
  | { type: 'step'; stepId: string }
  | null {
  try {
    return JSON.parse(event.dataTransfer.getData('application/json')) as
      | { type: 'resource'; stepId: string; kind: 'input' | 'output'; resourceId: string }
      | { type: 'step'; stepId: string };
  } catch {
    return null;
  }
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

  function startDrag(event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData('application/json', JSON.stringify({ type: 'step', stepId: step.id }));
    event.dataTransfer.effectAllowed = 'move';
  }

  function finishDrag(event: DragEvent<HTMLDivElement>) {
    const payload = dragPayload(event);
    if (payload?.type !== 'step') return;
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
    kind: 'input' | 'output',
    resourceId: string,
  ) {
    event.stopPropagation();
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({ type: 'resource', stepId: step.id, kind, resourceId }),
    );
    event.dataTransfer.effectAllowed = 'copy';
  }

  function dropOnStep(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragPayload(event);
    if (payload?.type === 'resource' && payload.stepId !== step.id) {
      onConnect(payload.stepId, payload.kind, payload.resourceId, step.id);
    }
  }

  return (
    <div
      className={`field-step ${selected ? 'selected' : ''}`}
      style={{ left: position.x, top: position.y }}
      draggable
      onClick={onSelect}
      onDragStart={startDrag}
      onDragEnd={finishDrag}
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropOnStep}
      title="Click to configure · drag to move"
    >
      <div className="field-step-title">{step.name || 'Unnamed step'}</div>
      <div className="field-step-body">
        <div className="field-handles input-handles">
          {step.inputs.map((input, inputIndex) => (
            <div
              className="field-handle input-handle"
              key={`${input.resourceId}-${inputIndex}`}
              draggable
              onDragStart={(event) => startHandleDrag(event, 'input', input.resourceId)}
              title={`Input: ${resourceName(plan, input.resourceId)} · drag to another step`}
            >
              <span>{resourceName(plan, input.resourceId)}</span>
              <b>{input.amount}</b>
            </div>
          ))}
        </div>
        <div className="field-arrow">→</div>
        <div className="field-handles output-handles">
          {step.outputs.map((output, outputIndex) => (
            <div
              className="field-handle output-handle"
              key={`${output.resourceId}-${outputIndex}`}
              draggable
              onDragStart={(event) => startHandleDrag(event, 'output', output.resourceId)}
              title={`Output: ${resourceName(plan, output.resourceId)} · drag to another step`}
            >
              <b>{output.amount}</b>
              <span>{resourceName(plan, output.resourceId)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
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
