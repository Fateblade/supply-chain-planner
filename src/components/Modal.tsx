import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export type DialogRequest =
  | {
      kind: 'prompt';
      title: string;
      label: string;
      initial?: string;
      confirmLabel?: string;
      onConfirm: (value: string) => void;
    }
  | {
      kind: 'confirm';
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
      /** Informational dialog: renders a single dismiss button, no Cancel. */
      info?: boolean;
      onConfirm: () => void;
    };

/** Callback that opens a modal dialog (see App.ask). */
export type Ask = (request: DialogRequest) => void;

interface Props {
  request: DialogRequest;
  onClose: () => void;
}

/** In-app modal dialog used instead of native prompt/confirm.
 *  Moves focus into the dialog, traps Tab, restores focus on close. */
export function Modal({ request, onClose }: Props) {
  const [value, setValue] = useState(request.kind === 'prompt' ? (request.initial ?? '') : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Focus an interactive control: prompts focus+select the input, confirms focus the
    // confirm button so Enter confirms and Shift+Tab stays inside the trap.
    if (request.kind === 'prompt') inputRef.current?.select();
    else confirmRef.current?.focus();
    return () => previous?.focus();
  }, []);

  function confirmRequest() {
    if (request.kind === 'prompt') {
      if (!value.trim()) return;
      request.onConfirm(value);
    } else {
      request.onConfirm();
    }
    onClose();
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key === 'Tab') {
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const list = Array.from(focusables);
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  const confirmLabel = request.confirmLabel ?? (request.kind === 'prompt' ? 'OK' : 'Confirm');
  const danger = request.kind === 'confirm' && request.danger === true;
  const info = request.kind === 'confirm' && request.info === true;
  const disableConfirm = request.kind === 'prompt' && !value.trim();

  return (
    <div className="modal-backdrop" onMouseDown={onClose} onKeyDown={handleKey}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2>{request.title}</h2>
        {request.kind === 'confirm' && <p className="modal-message">{request.message}</p>}
        <form onSubmit={(event) => { event.preventDefault(); confirmRequest(); }}>
          {request.kind === 'prompt' && (
            <input
              ref={inputRef}
              value={value}
              placeholder={request.label}
              aria-label={request.label}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
          <div className="modal-actions">
            {!info && <button type="button" onClick={onClose}>Cancel</button>}
            <button ref={confirmRef} type="submit" className={danger ? 'danger' : ''} disabled={disableConfirm}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}