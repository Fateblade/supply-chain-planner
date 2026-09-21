# Supply Chain Planner Requirements

This is the living product record for the Supply Chain Planner. Add future requested changes here before implementation, and record the resulting decision or behavior in the change log.

## Product goal

Build a fast, easy-to-use supply-chain planning tool for defining production chains, calculating requirements, planning throughput, and reusing existing work.

The primary UX principle is **direct manipulation**: users should be able to create, configure, arrange, and connect steps without navigating through complex forms.

## Current state

### P1 — Production planning

- Resources can be created, renamed, marked as `raw`, and marked as final targets.
- Process steps have inputs and outputs with quantities.
- Final target amounts calculate required runs throughout the chain.
- Resource balances report raw requirements, balanced resources, surplus, and shortages.
- Plans autosave to browser localStorage.
- Plans can be exported to and imported from JSON.
- A sample electronics plan is available from the header.

### P2 — Time planning

- Each process step can define seconds per run (`s/run`).
- Targets can be one-off totals, per-minute rates, or per-hour rates.
- The results panel calculates runs per second and required parallel stations.
- Station counts are rounded up because partial stations are not useful.

### P3 — Reuse

- Individual steps can be saved as reusable templates.
- Step templates store resource names rather than resource IDs, making them portable between plans.
- Missing resources are created automatically when a step template is inserted.
- Whole plans can be saved and loaded as named plan templates.
- Templates persist in localStorage.

### Interactive field

- The application uses a dark theme by default.
- Process steps appear as movable nodes on a planning field.
- Double-clicking empty field space creates a new empty step.
- Clicking a node selects it and opens its configuration in the right sidebar.
- The sidebar retains editing for step name, inputs, outputs, duration, duplication, deletion, and template saving.
- Nodes can be dragged to rearrange the plan.
- Node positions persist with the plan.
- Each input and output is represented by a draggable port box.
- Dragging an output to an input creates a link.
- Dragging an input to an output creates a link in the reverse direction.
- Dropping onto an existing port reuses that port and does not create a duplicate.
- Dropping onto a node background creates a new port with quantity `1`.
- When connecting to an existing port, the dragged resource becomes the resource on that port.
- Links are rendered as SVG curves and move when either connected node moves.
- Links are persisted with the plan.
- Deleting a port, resource, or step removes or reindexes affected links.
- Duplicating a step copies the step configuration and position but never copies its links.

## Product decisions

- **Delivery:** Vite + React + TypeScript single-page application.
- **Backend:** None for the current product; browser localStorage is the persistence layer.
- **Calculation model:** demand-driven, non-negative least-squares calculation. Target demand is prioritized and shortages are reported rather than hidden.
- **Target semantics:** a target without a time frame is a one-off amount; a target with a time frame is a production rate.
- **Link model:** links connect specific indexed ports, not just resources or whole steps. This supports multiple inputs and outputs using the same resource.
- **Link compatibility:** `links` and step `position` are optional in the data model so older saved plans remain loadable.
- **Connection quantity:** a newly created port starts at quantity `1`; connecting to an existing port preserves its quantity.
- **Resource authority:** when a port-to-port connection is made, the dragged port's resource is assigned to the destination port.
- **Visual style:** dark mode is the default; the planning field uses a grid, nodes, port colors, and SVG connection curves.
- **Dragging:** node movement and port connection dragging are separate interactions. Port drops use the browser `copy` drop effect.

## Change log

### 2026-09-21

- Added persistent links between indexed input/output ports.
- Added SVG link rendering that follows moved nodes.
- Changed newly created field steps to start with no inputs or outputs.
- Added background-drop behavior for creating a new port with quantity `1`.
- Added existing-port linking without duplicate ports.
- Added link cleanup and index re-mapping when ports, resources, or steps are deleted.
- Ensured duplicated steps do not duplicate links.
- Fixed node dragging by tracking the node drag source instead of reading `dataTransfer` during `dragend`.
- Removed the browser's denied drag cursor by setting explicit drop effects.

### 2026-09-20

- Added dark interactive planning field.
- Added double-click step creation, node selection, node movement, and selected-step sidebar editing.
- Added persistent step positions.

### Earlier stages

- **P1:** resources, process steps, final targets, backward calculation, persistence, import/export.
- **P2:** target rates, step durations, throughput, and station counts.
- **P3:** reusable step templates and whole-plan templates.

## Working agreement for future changes

When adding a requested behavior:

1. Add or update the requirement in this file before implementation when the behavior is substantial.
2. Record important design decisions rather than only implementation details.
3. Preserve existing plan compatibility where practical.
4. Add a focused test for calculation or data-model behavior.
5. Run TypeScript checks, the full test suite, and the production build before committing.
6. Add the completed behavior to the change log after implementation.

## Future requirements

Record future requests here before implementation. Keep this section empty until a requirement has been explicitly requested or agreed upon.
