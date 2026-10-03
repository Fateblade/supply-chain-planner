import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';

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
      onConfirm: () => void;
    };

interface Props {
  request: DialogRequest;
  onClose: () => void;
}

/** In-app modal dialog used instead of native prompt/confirm. */
export function Modal({ request, onClose }: Props) {
  const [value, setValue] = useState(request.kind === 'prompt' ? (request.initial ?? '') : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
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
    if (event.key === 'Escape') onClose();
  }

  function stopPropagation(event: MouseEvent) {
    event.stopPropagation();
  }

  const confirmLabel = request.confirmLabel ?? (request.kind === 'prompt' ? 'OK' : 'Confirm');
  const danger = request.kind === 'confirm' && request.danger === true;
  const disableConfirm = request.kind === 'prompt' && !value.trim();

  return (
    <div className="modal-backdrop" onMouseDown={onClose} onKeyDown={handleKey}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        onMouseDown={stopPropagation}
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
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className={danger ? 'danger' : ''} disabled={disableConfirm}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}