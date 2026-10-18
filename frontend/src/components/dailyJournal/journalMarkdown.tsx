/**
 * Pipeline markdown journal : GFM + HTML brut filtré (anti-XSS).
 * Les pages journal sont derrière auth — pas d’impact SEO public.
 */
import type { MouseEvent, ReactNode } from 'react';
import type { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { Schema } from 'hast-util-sanitize';

/** Schéma étendu : tables GFM + balises formatage courantes ; scripts/handlers exclus. */
export const journalSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: Array.from(
    new Set([
      ...(defaultSchema.tagNames || []),
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'img',
      'span',
      'div',
      'br',
      'hr',
    ]),
  ),
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || []), 'href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    td: ['align', 'colspan', 'rowspan'],
    th: ['align', 'colspan', 'rowspan'],
    span: ['className', 'class'],
    div: ['className', 'class'],
    table: ['className', 'class'],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
};

export const journalRemarkPlugins = [remarkGfm];

export const journalRehypePlugins = [
  rehypeRaw,
  [rehypeSanitize, journalSanitizeSchema] as [typeof rehypeSanitize, Schema],
];

/**
 * Normalise / filtre les href markdown.
 * Rejette javascript:, data:, vbscript:, etc.
 */
export function sanitizeMarkdownHref(href: string | undefined | null): string | undefined {
  if (href == null) return undefined;
  const trimmed = String(href).trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
    return trimmed;
  }

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  if (/^(https?:|mailto:)/i.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

type LinkProps = {
  href?: string;
  children?: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function JournalSafeLink({
  href,
  children,
  className = 'text-blue-600 dark:text-blue-400 underline',
  onClick,
}: LinkProps) {
  const safeHref = sanitizeMarkdownHref(href);
  if (!safeHref) {
    return <span className={className}>{children}</span>;
  }
  return (
    <a href={safeHref} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
      {children}
    </a>
  );
}

/** Composants markdown de base (éditeur / modal). */
export const journalMarkdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-bold mt-2 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-semibold mt-2 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-semibold mt-2 mb-2">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-gray-800 dark:text-gray-200">{children}</li>,
  a: ({ href, children }) => <JournalSafeLink href={href}>{children}</JournalSafeLink>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-300 my-2">
      {children}
    </blockquote>
  ),
};
