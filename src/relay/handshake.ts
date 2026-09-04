import type { WebSocket } from 'ws';
import {
  ExtensionChallenge,
  ExtensionProof,
  HandshakeRole,
  HelloMessage,
  InstanceInfo,
  LockReason,
  MessageType,
} from '../extension/protocol';
import { computeProof, proofsMatch, randomNonce } from '../extension/hmac';
import { nextMessage, sendJson } from './ws-utils';
import type { KeyStore } from './keys';

const HANDSHAKE_TIMEOUT_MS = 5_000;

export interface Authentication {
  authenticated: boolean;
  lockReason?: LockReason;
  codeId?: string;
}

export interface HandshakeResult extends Authentication {
  instance: InstanceInfo;
}

export const authenticateExtension = async (ws: WebSocket, keys: KeyStore): Promise<HandshakeResult> => {
  const hello = await nextMessage(ws, HelloMessage, HANDSHAKE_TIMEOUT_MS);
  const { key, reason } = keys.match(hello.instance.id, hello.codeIds);
  if (!key) {
    sendJson(ws, { type: MessageType.Locked, reason });
    return { instance: hello.instance, authenticated: false, lockReason: reason };
  }

  const serverNonce = randomNonce();
  sendJson(ws, { type: MessageType.ServerChallenge, nonce: serverNonce, codeId: key.id });

  const challenge = await nextMessage(ws, ExtensionChallenge, HANDSHAKE_TIMEOUT_MS);
  sendJson(ws, { type: MessageType.ServerProof, proof: await computeProof(key.secret, challenge.nonce, HandshakeRole.Server) });

  const proof = await nextMessage(ws, ExtensionProof, HANDSHAKE_TIMEOUT_MS);
  const expected = await computeProof(key.secret, serverNonce, HandshakeRole.Extension);
  if (!proofsMatch(expected, proof.proof)) throw new Error('Extension presented an invalid code proof');
  return { instance: hello.instance, authenticated: true, codeId: key.id };
};
