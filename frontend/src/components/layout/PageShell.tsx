import React from 'react';
import clsx from 'clsx';
import { PAGE_SHELL_INNER } from './pageLayout';

export type PageShellVariant = 'default' | 'narrow' | 'fluid';

export interface PageShellProps {
  variant?: PageShellVariant;
  className?: string;
  children: React.ReactNode;
}

/**
 * Enveloppe standard des pages authentifiées : padding et largeur alignés sur pageLayout.
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
        <div className={clsx(PAGE_SHELL_INNER, 'flex min-h-0 flex-1 flex-col')}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'w-full bg-gray-50 dark:bg-gray-900',
        variant === 'narrow' && 'mx-auto max-w-3xl',
        PAGE_SHELL_INNER,
        className
      )}
    >
      {children}
    </div>
  );
};

export default PageShell;
