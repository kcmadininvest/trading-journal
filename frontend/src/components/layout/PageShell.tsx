import React from 'react';
import clsx from 'clsx';

export type PageShellVariant = 'default' | 'narrow' | 'fluid';

export interface PageShellProps {
  variant?: PageShellVariant;
  className?: string;
  children: React.ReactNode;
}

/**
 * Enveloppe standard des pages authentifiées. Vertical : classe .layout-page-shell-y (index.css) ;
 * horizontal : classes Tailwind px-* en littéraux ci-dessous (scanner JIT).
 * - default : pleine largeur sous le header.
 * - narrow : max-w-3xl centré (ex. réglages).
 * - fluid : colonne flex-1 pour coller le footer en bas (listes / tableaux scrollables).
 */
const PageShell: React.FC<PageShellProps> = ({
  variant = 'default',
  className,
  children,
}) => {
  if (variant === 'fluid') {
    return (
      <div
        className={clsx(
          'flex w-full min-h-0 flex-1 flex-col bg-gray-50 dark:bg-gray-900',
          className
        )}
      >
        <div
          className={clsx(
            'layout-page-shell-y flex min-h-0 flex-1 flex-col',
            'px-3 sm:px-4 md:px-6 lg:px-8'
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'w-full bg-gray-50 dark:bg-gray-900 layout-page-shell-y',
        'px-3 sm:px-4 md:px-6 lg:px-8',
        variant === 'narrow' && 'mx-auto max-w-3xl',
        className
      )}
    >
      {children}
    </div>
  );
};

export default PageShell;
