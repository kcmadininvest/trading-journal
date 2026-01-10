import React from 'react';
import clsx from 'clsx';
import { toast, useToaster, useToasterStore, resolveValue, Toast } from 'react-hot-toast/headless';

const baseToastClasses =
  'pointer-events-auto w-full max-w-sm rounded-2xl border shadow-lg shadow-gray-900/10 dark:shadow-black/40 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-gray-900';

const typeStyles: Record<Toast['type'], string> = {
  success:
    'bg-white border-emerald-200 text-emerald-900 dark:bg-gray-900 dark:border-emerald-800 dark:text-emerald-100',
  error:
    'bg-white border-rose-200 text-rose-900 dark:bg-gray-900 dark:border-rose-800 dark:text-rose-100',
  loading:
    'bg-white border-amber-200 text-amber-900 dark:bg-gray-900 dark:border-amber-700 dark:text-amber-100',
  blank:
    'bg-white border-gray-200 text-gray-900 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100',
  custom:
    'bg-white border-indigo-200 text-indigo-900 dark:bg-gray-900 dark:border-indigo-700 dark:text-indigo-100',
};

const iconClasses =
  'flex h-10 w-10 items-center justify-center rounded-full text-white shadow-inner shadow-black/10';

const defaultIcons: Record<Toast['type'], React.ReactNode> = {
  success: (
    <div className={clsx(iconClasses, 'bg-emerald-500')}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  ),
  error: (
    <div className={clsx(iconClasses, 'bg-rose-500')}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  ),
  loading: (
    <div className={clsx(iconClasses, 'bg-amber-500')}>
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle className="opacity-30" cx="12" cy="12" r="10" />
        <path className="opacity-80" d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
      </svg>
    </div>
  ),
  blank: (
    <div className={clsx(iconClasses, 'bg-blue-500')}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      </svg>
    </div>
  ),
  custom: (
    <div className={clsx(iconClasses, 'bg-indigo-500')}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h10M4 17h4" />
      </svg>
    </div>
  ),
};

const ToastViewport: React.FC = () => {
  const { handlers } = useToaster({
    duration: 4000,
    position: 'top-right',
  });
  const { toasts } = useToasterStore();

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed top-4 left-0 right-0 z-[60] flex flex-col items-center gap-3 px-4 sm:items-end">
      {toasts.map((toastItem) => {
        const body = resolveValue(toastItem.message, toastItem);
        const typeClass = typeStyles[toastItem.type] ?? typeStyles.blank;

        return (
          <div
            key={toastItem.id}
            role={toastItem.ariaProps?.role ?? 'status'}
            aria-live={toastItem.ariaProps?.['aria-live'] ?? 'polite'}
            className={clsx(
              baseToastClasses,
              typeClass,
              'flex gap-4 p-4 backdrop-blur',
              toastItem.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
            )}
            onMouseEnter={handlers.startPause}
            onMouseLeave={handlers.endPause}
          >
            {toastItem.icon ? (
              <div className="flex h-10 w-10 items-center justify-center">{toastItem.icon}</div>
            ) : (
              defaultIcons[toastItem.type] ?? defaultIcons.blank
            )}

            <div className="flex-1 text-left">
              <div className="text-sm font-semibold tracking-tight">{toastItem.type === 'loading' ? 'Chargement' : null}</div>
              <div className="text-sm leading-relaxed text-current">{body}</div>
              {toastItem.type === 'loading' && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-current/10">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-current/60"></div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => toast.dismiss(toastItem.id)}
              className="text-current/60 transition hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-gray-900 rounded-full"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastViewport;
