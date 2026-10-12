import { X } from 'lucide-react';
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** When set, the body is a <form> and Enter submits it. */
  onSubmit?: () => void;
  size?: 'md' | 'lg';
}

/** Modal built on the native <dialog>: focus trapping and Esc come from the browser. */
export function Dialog({ open, onClose, title, description, children, footer, onSubmit, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };

  const body = (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 id={titleId} className="text-xl font-bold text-slate-900">
            {title}
          </h2>
          {description && <div className="mt-1 text-slate-600">{description}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-m-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="סגירה"
        >
          <X className="h-6 w-6" aria-hidden />
        </button>
      </div>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-5">{children}</div>
      {footer && <div className="flex flex-wrap-reverse justify-end gap-2 border-t border-slate-200 px-5 py-4">{footer}</div>}
    </>
  );

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`m-auto w-[calc(100%-1.5rem)] ${size === 'lg' ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl bg-white p-0 text-slate-900 shadow-2xl`}
      aria-labelledby={titleId}
    >
      {open && (onSubmit ? <form onSubmit={handleSubmit} noValidate>{body}</form> : body)}
    </dialog>
  );
}
