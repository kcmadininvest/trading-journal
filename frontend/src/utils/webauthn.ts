/** Helpers WebAuthn : conversion base64url <-> ArrayBuffer et sérialisation JSON. */

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

export async function isConditionalMediationAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  const pkc = window.PublicKeyCredential as typeof PublicKeyCredential & {
    isConditionalMediationAvailable?: () => Promise<boolean>;
  };
  if (typeof pkc.isConditionalMediationAvailable !== 'function') return false;
  try {
    return await pkc.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}

export function base64urlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bufferToBase64url(buffer: ArrayBuffer | null | undefined): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type JsonDescriptor = { id: string; [key: string]: unknown };

function decodeDescriptors(list: unknown): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return (list as JsonDescriptor[]).map((item) => ({
    ...(item as object),
    id: base64urlToBuffer(item.id),
  })) as PublicKeyCredentialDescriptor[];
}

/** Options JSON du serveur -> PublicKeyCredentialCreationOptions (buffers décodés). */
export function parseCreationOptions(options: any): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: { ...options.user, id: base64urlToBuffer(options.user.id) },
    excludeCredentials: decodeDescriptors(options.excludeCredentials),
  } as PublicKeyCredentialCreationOptions;
}

/** Options JSON du serveur -> PublicKeyCredentialRequestOptions (buffers décodés). */
export function parseRequestOptions(options: any): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: decodeDescriptors(options.allowCredentials),
  } as PublicKeyCredentialRequestOptions;
}

/** Credential navigateur -> objet JSON-sérialisable (base64url). */
export function serializeCredential(credential: Credential): Record<string, unknown> {
  const pkc = credential as PublicKeyCredential;
  const response = pkc.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse;
  const base = {
    id: pkc.id,
    rawId: bufferToBase64url(pkc.rawId),
    type: pkc.type,
    authenticatorAttachment: pkc.authenticatorAttachment ?? undefined,
    clientExtensionResults: pkc.getClientExtensionResults?.() ?? {},
  };

  if ('attestationObject' in response && response.attestationObject) {
    return {
      ...base,
      response: {
        clientDataJSON: bufferToBase64url(response.clientDataJSON),
        attestationObject: bufferToBase64url(response.attestationObject),
        transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
      },
    };
  }

  return {
    ...base,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  };
}

/** Sépare challenge_id des options WebAuthn (accepte `{ options, challenge_id }` ou options à plat). */
export function splitChallengeResponse(data: any): { challengeId: string; options: any } {
  const { challenge_id: challengeId, options, ...rest } = data || {};
  return { challengeId, options: options ?? rest };
}
