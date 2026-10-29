'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X, Stethoscope, ChevronRight, Plus } from 'lucide-react';
import { type Care, type CareStatus, statusLabels, localDate } from '@sos/contracts';
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose} onClose={onClose} aria-labelledby="modal-title">
      <header className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">
          <X />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Status({ status }: { status: CareStatus }) {
  return (
    <span
      className={
        'pill' +
        (['cancelled', 'failed'].includes(status)
          ? ' pill-red'
          : ['submitted', 'to_confirm', 'searching', 'assigned'].includes(status)
            ? ' pill-warn'
            : '')
      }
    >
      {statusLabels[status]}
    </span>
  );
}
export function Empty({
  title = 'Aucune demande pour le moment',
  text = 'Vos prochaines demandes et leurs étapes apparaîtront ici.',
  action,
  onAction,
}: {
  title?: string;
  text?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <span className="icon-tile">
        <Stethoscope size={24} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && onAction && (
        <button className="btn btn-sm" onClick={onAction}>
          <Plus size={15} />
          {action}
        </button>
      )}
    </div>
  );
}
export function CareRows({ items, onOpen }: { items: Care[]; onOpen: (c: Care) => void }) {
  return (
    <div>
      {items.map((c) => (
        <button className="care-row" key={c.id} onClick={() => onOpen(c)}>
          <span className="icon-tile">
            <Stethoscope size={20} />
          </span>
          <span>
            <strong>{c.serviceName}</strong>
            <small>
              {c.beneficiaryName} · {c.zone}
            </small>
          </span>
          <span className="date">{localDate(c.startAt)}</span>
          <Status status={c.status} />
          <ChevronRight size={17} />
        </button>
      ))}
    </div>
  );
}
export function Pagination({
  page,
  total,
  size,
  onPage,
}: {
  page: number;
  total: number;
  size: number;
  onPage: (n: number) => void;
}) {
  return total > size ? (
    <div className="pagination">
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Précédent
      </button>
      <span>
        Page {page} / {Math.ceil(total / size)}
      </span>
      <button
        className="btn btn-outline btn-sm"
        disabled={page * size >= total}
        onClick={() => onPage(page + 1)}
      >
        Suivant
      </button>
    </div>
  ) : null;
}
