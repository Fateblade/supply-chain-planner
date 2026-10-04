import { useEffect, useRef, useState } from 'react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { Plan, PortKind, ProcessStep, StepLink } from '../model/types';

interface Props {
  plan: Plan;
  selectedStepId?: string;
  onSelect: (stepId: string) => void;
  onMove: (stepId: string, x: number, y: number) => void;
  onAddStep: (x: number, y: number) => void;
  /** Double-click a step's input handle: create a step that makes that resource. */
  onCreateProducer: (resourceId: string) => void;
  /** Single click a step's input handle: offer library steps that make it. */
  onOfferProducers: (resourceId: string, stepId: string, inputIndex: number) => void;
  /** Rearrange all steps into link-flow columns. */
  onAutoLayout: () => void;
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
/** Planning-field base size; matches the .field-canvas CSS minimums. */
const FIELD_W = 1040;
const FIELD_H = 760;
/** Room beyond the farthest step so new ones can be placed past it. */
const FIELD_MARGIN = 600;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

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
  zoom,
  selected,
  onSelect,
  onMove,
  onConnect,
  onCreateProducer,
  onOfferProducers,
}: {
  plan: Plan;
  step: ProcessStep;
  index: number;
  zoom: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onConnect: Props['onConnect'];
  onCreateProducer: Props['onCreateProducer'];
  onOfferProducers: Props['onOfferProducers'];
}) {
  const position = step.position ?? defaultPosition(index);
  const nodeDragStarted = useRef(false);
  const handleDragged = useRef(false);

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
      Math.max(NODE_WIDTH / 2, (event.clientX - bounds.left) / zoom),
      Math.max(NODE_HEIGHT / 2, (event.clientY - bounds.top) / zoom),
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
    handleDragged.current = true;
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
        onClick={() => {
          // A handle drag suppresses the trailing click so it doesn't
          // open the library picker.
          if (handleDragged.current) {
            handleDragged.current = false;
            return;
          }
          if (isInput) onOfferProducers(resourceId, step.id, index);
        }}
        onDoubleClick={isInput ? () => onCreateProducer(resourceId) : undefined}
        title={`${isInput ? 'Input' : 'Output'}: ${resourceName(plan, resourceId)} · drag to connect${
          isInput ? ' · click for library steps · double-click to create one' : ''
        }`}
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

function LinkLines({ plan, selectedStepId }: { plan: Plan; selectedStepId?: string }) {
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
        const touchesSelected =
          link.from.stepId === selectedStepId || link.to.stepId === selectedStepId;
        return <path key={link.id} d={linkPath(from, to)} className={touchesSelected ? 'linked' : undefined} />;
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
  onCreateProducer,
  onOfferProducers,
  onAutoLayout,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Mirror of viewState so imperative handlers always read fresh values.
  const view = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const [viewState, setViewState] = useState(view.current);
  const [panning, setPanning] = useState(false);

  // Content plane: base size plus room past the farthest step, so pan and
  // zoom always reach steps placed outside the original viewport.
  const plane = useRef({ w: FIELD_W, h: FIELD_H });
  const planeW = Math.max(
    FIELD_W,
    ...plan.steps.map((step) => (step.position?.x ?? 0) + FIELD_MARGIN),
  );
  const planeH = Math.max(
    FIELD_H,
    ...plan.steps.map((step) => (step.position?.y ?? 0) + FIELD_MARGIN),
  );
  plane.current = { w: planeW, h: planeH };

  function applyView(next: { zoom: number; pan: { x: number; y: number } }) {
    // Keep the canvas visual box overlapping the viewport so the content
    // can never be panned or zoomed completely out of sight.
    const el = scrollRef.current;
    if (el) {
      const vpW = el.clientWidth;
      const vpH = el.clientHeight;
      next.pan = {
        x: Math.min(0, Math.max(vpW - plane.current.w * next.zoom, next.pan.x)),
        y: Math.min(0, Math.max(vpH - plane.current.h * next.zoom, next.pan.y)),
      };
    }
    view.current = next;
    setViewState(next);
  }

  // Wheel zoom needs a non-passive listener: React's onWheel is passive,
  // so preventDefault there cannot stop the browser's own scroll/zoom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const viewport = el.getBoundingClientRect();
      const mx = event.clientX - viewport.left;
      const my = event.clientY - viewport.top;
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      const current = view.current;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * factor));
      const ratio = zoom / current.zoom;
      applyView({
        zoom,
        // Zoom about the cursor: the content under the mouse stays there.
        pan: { x: mx - (mx - current.pan.x) * ratio, y: my - (my - current.pan.y) * ratio },
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Middle-button drag pans the viewport (also disables native autoscroll).
  function startPan(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 1) return;
    event.preventDefault();
    setPanning(true);
    const startX = event.clientX;
    const startY = event.clientY;
    const base = view.current.pan;
    const zoom = view.current.zoom;
    const move = (e: globalThis.MouseEvent) => {
      applyView({ zoom, pan: { x: base.x + e.clientX - startX, y: base.y + e.clientY - startY } });
    };
    const stop = () => {
      setPanning(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
  }

  // Attached to the scroll container so double-clicking the background
  // beyond the content plane also places a step.
  function addOnDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('.field-step')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    // The canvas is visually transformed; convert screen px to content px.
    onAddStep(
      (event.clientX - bounds.left - view.current.pan.x) / view.current.zoom,
      (event.clientY - bounds.top - view.current.pan.y) / view.current.zoom,
    );
  }

  const viewChanged = viewState.zoom !== 1 || viewState.pan.x !== 0 || viewState.pan.y !== 0;

  return (
    <section className="field-panel">
      <div className="field-toolbar">
        <div>
          <h2>Planning field</h2>
          <p>
            Double-click to add a step · drag nodes to arrange · drag handles to connect · wheel to
            zoom · middle-drag to pan
          </p>
        </div>
        <div className="field-tools">
          <button type="button" className="link" onClick={onAutoLayout} title="Arrange steps into link-flow columns">
            Auto layout
          </button>
          <span className="field-divider" aria-hidden="true" />
          <span className="field-count">{plan.steps.length} steps</span>
          {viewChanged && (
            <>
              <span className="field-divider" aria-hidden="true" />
              <button
                type="button"
                className="link"
                onClick={() => applyView({ zoom: 1, pan: { x: 0, y: 0 } })}
              >
                Reset view
              </button>
            </>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        className={`field-scroll ${panning ? 'panning' : ''}`}
        onMouseDown={startPan}
        onDoubleClick={addOnDoubleClick}
      >
        <div
          className="field-canvas"
          style={{
            width: planeW,
            height: planeH,
            transform: `translate(${viewState.pan.x}px, ${viewState.pan.y}px) scale(${viewState.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <LinkLines plan={plan} selectedStepId={selectedStepId} />
          {plan.steps.map((step, index) => (
            <StepNode
              key={step.id}
              plan={plan}
              step={step}
              index={index}
              zoom={viewState.zoom}
              selected={step.id === selectedStepId}
              onSelect={() => onSelect(step.id)}
              onMove={(x, y) => onMove(step.id, x, y)}
              onConnect={onConnect}
              onCreateProducer={onCreateProducer}
              onOfferProducers={onOfferProducers}
            />
          ))}
        </div>
        {plan.steps.length === 0 && (
          <div className="field-empty">Double-click anywhere to add your first process step.</div>
        )}
      </div>
    </section>
  );
}
