import type { WebSocket } from 'ws';
import {
  ExtensionChallenge,
  ExtensionProof,
  HandshakeRole,
  InstanceInfo,
  MessageType,
} from '../extension/protocol';
import { computeProof, proofsMatch, randomNonce } from '../extension/hmac';
import { nextMessage, sendJson } from './ws-utils';

const HANDSHAKE_TIMEOUT_MS = 5_000;

export const authenticateExtension = async (
  ws: WebSocket,
  token: string,
): Promise<InstanceInfo> => {
  const serverNonce = randomNonce();
  sendJson(ws, { type: MessageType.ServerChallenge, nonce: serverNonce });

  const challenge = await nextMessage(ws, ExtensionChallenge, HANDSHAKE_TIMEOUT_MS);
  const serverProof = await computeProof(token, challenge.nonce, HandshakeRole.Server);
  sendJson(ws, { type: MessageType.ServerProof, proof: serverProof });

  const proof = await nextMessage(ws, ExtensionProof, HANDSHAKE_TIMEOUT_MS);
  const expected = await computeProof(token, serverNonce, HandshakeRole.Extension);
  if (!proofsMatch(expected, proof.proof)) {
    throw new Error('Extension presented an invalid token proof');
  }
  return proof.instance;
};
