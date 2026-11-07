import React, { useEffect, useId, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface AccessibleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Largeur max du panneau */
  size?: 'md' | 'lg' | 'xl' | '2xl';
  /** Contenu du footer (actions) */
  footer?: React.ReactNode;
  /** Classe additionnelle sur le panneau */
  className?: string;
  /** Empêche la fermeture via Escape / backdrop */
  disableClose?: boolean;
  /** Id optionnel pour aria-labelledby (sinon généré) */
  titleId?: string;
  descriptionId?: string;
}

const SIZE_CLASS: Record<NonNullable<AccessibleDialogProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

/**
 * Dialog accessible : role=dialog, aria-modal, focus trap, Escape, restore focus.
 */
const AccessibleDialog: React.FC<AccessibleDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'lg',
  footer,
  className = '',
  disableClose = false,
  titleId: titleIdProp,
  descriptionId: descriptionIdProp,
}) => {
  const generatedId = useId();
  const titleId = titleIdProp || `${generatedId}-title`;
  const descriptionId = descriptionIdProp || `${generatedId}-desc`;
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusables = panel
      ? (Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[])
      : [];
    const first = focusables[0];
    (first || panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, onClose, disableClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !disableClose) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${SIZE_CLASS[size]} border border-gray-100 dark:border-gray-700 overflow-hidden outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-blue-100 dark:border-blue-900/40 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-6 py-4">
          <h2 id={titleId} className="text-xl font-bold text-gray-900 dark:text-gray-100 pr-10">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
          {!disableClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-3 z-20 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-2 hover:bg-white/80 dark:hover:bg-gray-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6">{children}</div>

        {footer && (
          <div className="px-6 pb-6 flex flex-wrap justify-end gap-2 border-t border-gray-100 dark:border-gray-700 pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessibleDialog;
