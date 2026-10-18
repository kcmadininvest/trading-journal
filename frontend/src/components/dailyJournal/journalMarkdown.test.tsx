import { render, screen } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import { describe, expect, it } from 'vitest';
import {
  journalMarkdownComponents,
  journalRehypePlugins,
  journalRemarkPlugins,
  sanitizeMarkdownHref,
} from './journalMarkdown';

function renderJournalMarkdown(content: string) {
  return render(
    <ReactMarkdown
      remarkPlugins={journalRemarkPlugins}
      rehypePlugins={journalRehypePlugins}
      components={journalMarkdownComponents}
    >
      {content}
    </ReactMarkdown>,
  );
}

describe('sanitizeMarkdownHref', () => {
  it('prefixes scheme-less URLs with https', () => {
    expect(sanitizeMarkdownHref('example.com/path')).toBe('https://example.com/path');
  });

  it('keeps http(s) and mailto', () => {
    expect(sanitizeMarkdownHref('https://example.com')).toBe('https://example.com');
    expect(sanitizeMarkdownHref('mailto:a@b.c')).toBe('mailto:a@b.c');
  });

  it('rejects javascript and data URLs', () => {
    expect(sanitizeMarkdownHref('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeMarkdownHref('data:text/html,<script>')).toBeUndefined();
  });

  it('keeps relative and hash links', () => {
    expect(sanitizeMarkdownHref('/media/x.png')).toBe('/media/x.png');
    expect(sanitizeMarkdownHref('#section')).toBe('#section');
  });
});

describe('journal markdown sanitize pipeline', () => {
  it('strips script tags from raw HTML', () => {
    const { container } = renderJournalMarkdown('Hello <script>alert(1)</script> world');
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('Hello');
    expect(container.textContent).toContain('world');
    expect(container.textContent).not.toContain('alert(1)');
  });

  it('strips event-handler attributes', () => {
    const { container } = renderJournalMarkdown('<img src="https://example.com/a.png" onerror="alert(1)" alt="x" />');
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('onerror')).toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png');
  });

  it('does not render javascript href as a link', () => {
    renderJournalMarkdown('<a href="javascript:alert(1)">click</a>');
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('click')).toBeTruthy();
  });

  it('preserves GFM markdown tables', () => {
    const md = `| A | B |
| --- | --- |
| 1 | 2 |`;
    const { container } = renderJournalMarkdown(md);
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('td').length).toBeGreaterThanOrEqual(2);
  });

  it('keeps relative journal image src (signed media paths)', () => {
    const { container } = renderJournalMarkdown(
      '<img src="/api/daily-journal/journal-images/1/?s=token" alt="chart" />',
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/api/daily-journal/journal-images/1/?s=token');
  });
});
