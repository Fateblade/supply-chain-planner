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

### Workspaces and plans

- Users can create and switch between named workspaces.
- Each workspace owns a separate resource catalog, step-template library, and plan-template library.
- All plans in a workspace share that workspace's resource catalog.
- A workspace can contain multiple named plans; users can create, select/load, save, rename, and delete them.
- Plans keep their own steps, targets, and links. The workspace's resource catalog is authoritative and is combined with the active plan for calculations and editing.
- Workspaces and plans persist in browser localStorage.
- On upgrade, the current saved plan and both existing template libraries migrate into the initial **Game: Spacecraft** workspace.
- Workspace and plan management lives in a collapsible left sidepanel, collapsed by default. The header shows only `<Workspace Name>: <Selected Plan Name>` as text.
- The expanded sidepanel shows a workspace combobox with new (+), rename (R), and delete (D, with confirmation) buttons, a splitter, a scrollable plan list with the selected plan highlighted, and new/rename/delete plan buttons at the bottom. All buttons have hover tooltips.
- The sidepanel is a full-height overlay anchored to the left edge: while collapsed, the header and main content keep a left margin aligned to the strip; when expanded, the panel overlays the resource and library panels without shifting content.
- The app fills the viewport height with no page scrollbar: side columns scroll internally and the planning field resizes with the window. On narrow (single-column) layouts the page scrolls normally.
- The planning field's dotted background fills the whole bordered field area at any window size.
- All creation, rename, and delete questions (workspaces, plans, step templates) use an in-app modal dialog with keyboard support (Enter confirms, Escape cancels); destructive actions use a red confirm button. Native prompt/confirm dialogs are no longer used.
- The collapsed strip reads "Workspaces" and "Plans" top to bottom with an expand indicator (›); the expanded panel shows a collapse indicator (‹).

### Step details, notes, and keyboard

- The selected-step card has two header rows: row 1 is the name plus a template star; row 2 is the `s/run` input (widened ~1.6×) with duplicate and delete on the right.
- Deselecting is a bare clickable × in the panel heading; deleting a step is a raised `D` icon button that always asks for confirmation.
- The Delete key deletes the selected step using the same confirmation, and is ignored while typing in inputs, textareas, selects, or contenteditable elements.
- Creating a step puts the cursor in its name field; Enter in the name field leaves the field.
- The card shows a filled yellow star when an identical copy of the step is already in the library; matching covers name, duration, note, inputs, and outputs, so editing a step un-fills the star.
- Each step has an optional free-form note, editable in a textarea below the outputs.
- Commands that cannot work are disabled with the reason in the tooltip instead of being clickable and refusing: deleting the last workspace and deleting a workspace's last plan are grayed out with an explanation.

### Interactive field

- The application uses a dark theme by default.
- Process steps appear as movable nodes on a planning field.
- Double-clicking empty field space creates a new empty step.
- Clicking a node selects it and opens its configuration in the right sidebar.
- The sidebar retains editing for step name, inputs, outputs, duration, duplication, deletion, template saving, and notes.
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
- Single-clicking an input port opens a dialog listing library step templates that produce that resource; picking one inserts a copy one row below the needing step, already connected from its matching output to the clicked input. With no matches, an info dialog suggests saving a template first.
- Double-clicking an input port creates a new step named after that resource with it as output, placed one row below the needing step, and selects it.
- When a step is selected, its direct link lines are highlighted.
- The mouse wheel over the field zooms about the cursor between 0.4× and 2.5×; holding the middle mouse button pans the viewport. Pan and zoom cannot push the content fully out of sight, and a Reset view control appears whenever the view has changed.
- The dotted background belongs to the viewport and fills it at any pan or zoom. The field canvas is a content plane sized to fit every step plus margin, so steps placed outside the original viewport stay reachable, and double-clicking beyond the plane still places a step.
- The field toolbar reads Auto layout | steps count in a small bordered pill | Reset view, separated by thin vertical dividers.
- A display-mode toggle switches the port amounts between per single run (the recipe amounts, default) and the total needed to satisfy the set targets (amount × required runs for that step).
- An Auto layout button rearranges all steps into layered columns following link flow (producers left, consumers right), cycle-safe, with each column centered vertically.
- Steps with a note show a small toggle strip at the bottom of the node; clicking expands the node below the body to show the note, with separators between body/note and note/arrow, and the collapse arrow moves below the text when expanded.

### Deployment

- The app ships as a Docker container: a multi-stage build compiles the bundle with Node and serves `dist/` with nginx.
- The nginx config serves the SPA fallback, caches hashed assets long-term, and sets basic security headers.
- The container is stateless: all user data lives in browser localStorage, so plans are per-browser, not per-container.
- The README documents both run paths ("Run it locally" and "Run it in Docker") with one command per fenced block.

## Product decisions

- **Delivery:** Vite + React + TypeScript single-page application.
- **Backend:** None for the current product; browser localStorage is the persistence layer.
- **Workspace model:** resources and both template libraries belong to a workspace; its plans share that workspace resource catalog and each retain their own production steps, targets, and links.
- **Upgrade migration:** the existing single plan and template libraries migrate into the initial “Game: Spacecraft” workspace.
- **Calculation model:** demand-driven, non-negative least-squares calculation. Target demand is prioritized and shortages are reported rather than hidden.
- **Target semantics:** a target without a time frame is a one-off amount; a target with a time frame is a production rate.
- **Link model:** links connect specific indexed ports, not just resources or whole steps. This supports multiple inputs and outputs using the same resource.
- **Link compatibility:** `links` and step `position` are optional in the data model so older saved plans remain loadable.
- **Connection quantity:** a newly created port starts at quantity `1`; connecting to an existing port preserves its quantity.
- **Resource authority:** when a port-to-port connection is made, the dragged port's resource is assigned to the destination port.
- **Visual style:** dark mode is the default; the planning field uses a grid, nodes, port colors, and SVG connection curves.
- **Dragging:** node movement and port connection dragging are separate interactions. Port drops use the browser `copy` drop effect.
- **Unavailable commands:** commands that cannot work are rendered disabled with the reason in the tooltip, instead of accepting the click and showing an info dialog afterwards.
- **Library matching:** a step counts as "already in the library" only on a full content match (name, duration, note, inputs, outputs), so edited variants can be saved as new templates.
- **Producer picker:** inserting a library step from an input port uses the standard port-link mechanism and positions the copy one row below the needing step, keeping manual drag-connect and picker inserts on one code path.
- **Auto layout:** layered longest-path layout that ignores cycle back-edges so production loops cannot hang it; it reuses the field's default grid pitch.
- **Port amount modes:** the per-run recipe amounts remain the default; target totals reuse the solver's run counts so the field always agrees with the results panel.
- **Field viewport:** zoom/pan transforms a content plane that grows with the steps; the dotted background is untransformed so it always fills the viewport.
- **Deployment:** the container is deliberately stateless; localStorage remains the single persistence layer, so dockerized and locally-run instances behave identically.

## Change log

### 2026-10-03 (docker-deploy branch)

- Added a port display-mode toggle in the field header: per single run (recipe amounts, default) versus per target totals (amount × required runs from the solver), shown on every port box.
- Added a Docker deployment: multi-stage Dockerfile (Node build → nginx serve), nginx.conf with SPA fallback/asset caching/security headers, and .dockerignore; verified the image builds and serves.
- Documented Docker and local run commands in the README with one command per fenced block under "Run it locally" and "Run it in Docker", and dropped the phase marker from the usage heading.
- Delete workspace/plan buttons are now disabled with the reason in the tooltip instead of showing an info dialog after clicking.
- Redesigned the selected-step card: name + template star on row 1, s/run + duplicate/delete on row 2; Needs and Makes stack vertically with a centered downward arrow so io rows use the full panel width.
- Made deselect a bare × and delete a raised `D` button with confirmation, matching the workspace panel icon set.
- New steps autofocus the name field; Enter leaves the field.
- Double-clicking an input port creates a producing step named after the resource, one row below, pre-selected.
- Single-clicking an input port opens a choice dialog of library step templates that make that resource; inserts are auto-connected from their matching output to the clicked input. The modal system gained a reusable `choice` dialog kind.
- A filled yellow star marks steps already saved in the library (full content match, note included).
- The Delete key deletes the selected step with the same confirmation as the button; the delete confirmation moved into App so both share one path.
- Added wheel zoom about the cursor (0.4×–2.5×) and middle-drag pan with clamps and a Reset view control.
- Moved the dotted background to the viewport and turned the canvas into a content plane that grows with the steps, making off-viewport steps reachable and background double-click placement work everywhere.
- Added an Auto layout button (link-flow layered columns, cycle-safe, column-centered) and redesigned the field toolbar: Auto layout | steps pill | Reset view with thin dividers.
- Added step notes: textarea on the card, preserved through templates and the star check, with an expandable note section on the field node (arrow below the text when expanded).

### 2026-09-21

- Refactored the dialog wiring (askPrompt/askConfirm/askInfo helpers, shared Ask type, clearSelection), tidied panel components and CSS, and added an npm typecheck script; no behavior change.
- Replaced all native prompt/confirm/alert dialogs with an in-app modal (backdrop, Escape/Enter keys, danger styling for destructive confirmations).
- Made the expanded Workspaces title itself collapse the panel and added a "Plans" heading above the plan list.
- Made the app fill the viewport without a page scrollbar (side columns scroll internally, field resizes with the window) and made the planning field background cover the whole bordered area.
- Reworked the workspace/plan sidepanel into a full-height overlay on the left edge: the collapsed strip keeps header and content aligned via a left margin, and the expanded panel overlays the resource and library panels.
- Added a collapsible workspace/plan sidepanel on the left, collapsed by default, with workspace and plan create/rename/delete controls, tooltips, and a scrollable plan list; the header now shows only the active workspace and plan names.
- Added named workspaces with workspace-specific resources and libraries.
- Added multiple named plans per workspace with create, save, load, rename, and delete controls.
- Migrated the pre-workspace saved plan and libraries into the initial “Game: Spacecraft” workspace.
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
