import { useState } from 'react';
import type { Plan, Resource } from '../model/types';
import { removeResourceAndLinks } from '../model/links';
import { newId } from '../model/types';
import type { DialogRequest } from './Modal';

interface Props {
  plan: Plan;
  onChange: (plan: Plan) => void;
  ask: (request: DialogRequest) => void;
}

/** Left panel: add/rename resources, toggle raw (external) and target (final). */
export function ResourcePanel({ plan, onChange, ask }: Props) {
  const [draft, setDraft] = useState('');

  const targetIds = new Set(plan.targets.map((t) => t.resourceId));
  const usedByStep = (rid: string) =>
    plan.steps.some((s) => [...s.inputs, ...s.outputs].some((a) => a.resourceId === rid));

  function addResource() {
    const name = draft.trim();
    if (!name) return;
    onChange({
      ...plan,
      resources: [...plan.resources, { id: newId(), name, isRaw: false }],
    });
    setDraft('');
  }

  function update(rid: string, patch: Partial<Resource>) {
    onChange({
      ...plan,
      resources: plan.resources.map((r) => (r.id === rid ? { ...r, ...patch } : r)),
    });
  }

  function toggleTarget(rid: string) {
    const has = targetIds.has(rid);
    onChange({
      ...plan,
      targets: has
        ? plan.targets.filter((t) => t.resourceId !== rid)
        : [...plan.targets, { resourceId: rid, amount: 1 }],
    });
  }

  function remove(rid: string) {
    ask({
      kind: 'confirm',
      title: 'Delete resource',
      message: 'Delete this workspace resource? It will be removed from every plan in this workspace that uses it.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        const withoutResource = removeResourceAndLinks(plan, rid);
        onChange({
          ...withoutResource,
          resources: withoutResource.resources.filter((resource) => resource.id !== rid),
          targets: withoutResource.targets.filter((target) => target.resourceId !== rid),
        });
      },
    });
  }

  return (
    <section className="panel">
      <h2>Resources</h2>
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          addResource();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New resource… (Enter to add)"
        />
        <button type="submit" disabled={!draft.trim()}>
          Add
        </button>
      </form>
      <ul className="resource-list">
        {plan.resources.map((r) => (
          <li key={r.id} className="resource-row">
            <input
              className="name"
              value={r.name}
              onChange={(e) => update(r.id, { name: e.target.value })}
            />
            <button
              type="button"
              className={`toggle ${r.isRaw ? 'on' : ''}`}
              title="Raw: supplied from outside (mined/bought)"
              onClick={() => update(r.id, { isRaw: !r.isRaw })}
            >
              raw
            </button>
            <button
              type="button"
              className={`toggle star ${targetIds.has(r.id) ? 'on' : ''}`}
              title="Final: this is what you want to produce"
              onClick={() => toggleTarget(r.id)}
            >
              ★
            </button>
            <button
              type="button"
              className="icon danger"
              title={usedByStep(r.id) ? 'Delete (also removes it from steps)' : 'Delete'}
              onClick={() => remove(r.id)}
            >
              ×
            </button>
          </li>
        ))}
        {plan.resources.length === 0 && (
          <li className="empty-hint">Add your first resource above.</li>
        )}
      </ul>
      <p className="hint">
        <b>raw</b> = supplied from outside · <b>★</b> = final product you want
      </p>
    </section>
  );
}
