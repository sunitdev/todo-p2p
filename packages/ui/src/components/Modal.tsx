import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-label/30 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-[480px] max-w-[92vw] rounded-4 border border-separator bg-bg-l1 shadow-ambient">
        <header className="flex items-center justify-between border-b border-separator/40 px-5 py-4">
          <h2 className="text-headline font-semibold text-label">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-full text-label-secondary hover:bg-label/5"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-separator/40 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
