import { HandshakeRole } from './protocol';

const encoder = new TextEncoder();
const NONCE_BYTES = 16;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const randomNonce = (): string =>
  toHex(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));

export const computeProof = async (
  token: string,
  nonce: string,
  role: HandshakeRole,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${role}:${nonce}`));
  return toHex(new Uint8Array(signature));
};

export const proofsMatch = (expected: string, actual: string): boolean => {
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
};
