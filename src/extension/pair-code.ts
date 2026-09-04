import { digestHex } from './hmac';

export const CODE_VERSION = 'pwhs1';
const SEPARATOR = '-';
const SECRET_BYTES = 16;
const PROFILE_SHORT_LENGTH = 8;
const CODE_ID_LENGTH = 10;
const NEVER = '0';
const BASE36 = 36;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export interface PairCode {
  version: string;
  profileShort: string;
  expiresAt: number | null;
  secret: string;
}

export const toBase32 = (bytes: Uint8Array): string => {
  const bits = Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join('');
  const chunks = bits.match(/.{1,5}/g) ?? [];
  return chunks.map((c) => CROCKFORD[parseInt(c.padEnd(5, '0'), 2)]).join('');
};

export const profileShortOf = (profileId: string): string =>
  profileId.replace(/[^0-9a-z]/gi, '').slice(0, PROFILE_SHORT_LENGTH).toUpperCase();

export const mintPairCode = (profileId: string, expiresAt: number | null): string => {
  const secret = toBase32(crypto.getRandomValues(new Uint8Array(SECRET_BYTES)));
  const expiry = expiresAt === null ? NEVER : expiresAt.toString(BASE36);
  return [CODE_VERSION, profileShortOf(profileId), expiry, secret].join(SEPARATOR);
};

export const parsePairCode = (code: string): PairCode => {
  const [version, profileShort, expiry, secret, ...rest] = code.trim().split(SEPARATOR);
  if (version !== CODE_VERSION || !profileShort || !expiry || !secret || rest.length > 0) {
    throw new Error(`Malformed pair code. Expected ${CODE_VERSION}-<profile>-<expiry>-<secret>`);
  }
  return {
    version,
    profileShort: profileShort.toUpperCase(),
    expiresAt: expiry === NEVER ? null : parseInt(expiry, BASE36),
    secret,
  };
};

export const codeIdOf = async (secret: string): Promise<string> =>
  (await digestHex(secret)).slice(0, CODE_ID_LENGTH).toUpperCase();

export const isExpired = (expiresAt: number | null, now = Date.now()): boolean =>
  expiresAt !== null && now > expiresAt;

export const belongsTo = (code: PairCode, profileId: string): boolean =>
  code.profileShort === profileShortOf(profileId);
