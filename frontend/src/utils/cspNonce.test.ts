import { afterEach, describe, expect, it } from 'vitest';
import { canInjectInlineScript, getCspNonce, isValidCspNonce } from './cspNonce';

function setNonceMeta(content: string | null) {
  document.querySelectorAll('meta[name="csp-nonce"]').forEach((el) => el.remove());
  if (content === null) return;
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'csp-nonce');
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

afterEach(() => {
  setNonceMeta(null);
});

describe('isValidCspNonce', () => {
  it('rejects empty, DEV_ONLY and unevaluated SSI', () => {
    expect(isValidCspNonce(null)).toBe(false);
    expect(isValidCspNonce('')).toBe(false);
    expect(isValidCspNonce('DEV_ONLY')).toBe(false);
    expect(isValidCspNonce('<!--#echo encoding="none" var="UNIQUE_ID" -->')).toBe(false);
  });

  it('accepts opaque production nonces', () => {
    expect(isValidCspNonce('abc123XYZ')).toBe(true);
    expect(isValidCspNonce('ZxYz@1a2b3c4d')).toBe(true);
  });
});

describe('getCspNonce / canInjectInlineScript', () => {
  it('DEV_ONLY: get null, inject allowed (Vite)', () => {
    setNonceMeta('DEV_ONLY');
    expect(getCspNonce()).toBeNull();
    expect(canInjectInlineScript()).toBe(true);
  });

  it('missing meta: inject allowed', () => {
    setNonceMeta(null);
    expect(getCspNonce()).toBeNull();
    expect(canInjectInlineScript()).toBe(true);
  });

  it('real nonce: get value, inject allowed', () => {
    setNonceMeta('testNonceABC');
    expect(getCspNonce()).toBe('testNonceABC');
    expect(canInjectInlineScript()).toBe(true);
  });

  it('unevaluated SSI marker: get null, inject forbidden', () => {
    setNonceMeta('<!--#echo encoding="none" var="UNIQUE_ID" -->');
    expect(getCspNonce()).toBeNull();
    expect(canInjectInlineScript()).toBe(false);
  });
});
