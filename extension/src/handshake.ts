import { z } from 'zod';
import {
  HandshakeRole,
  InstanceInfo,
  LockReason,
  MessageType,
  ServerOpening,
  ServerProof,
} from '../../src/extension/protocol';
import { parsePairCode } from '../../src/extension/pair-code';
import { computeProof, proofsMatch, randomNonce } from '../../src/extension/hmac';
import { findLiveCode, listCodes, markUsed } from './codes';

const HANDSHAKE_TIMEOUT_MS = 5_000;

export enum HandshakeOutcome {
  Authenticated = 'authenticated',
  Locked = 'locked',
}

export interface HandshakeResult {
  outcome: HandshakeOutcome;
  reason?: LockReason;
}

export const nextMessage = <S extends z.ZodType>(
  ws: WebSocket,
  schema: S,
  timeoutMs = HANDSHAKE_TIMEOUT_MS,
): Promise<z.infer<S>> =>
  new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      ws.removeEventListener('close', onClose);
    };
    const fail = (reason: string): void => {
      cleanup();
      reject(new Error(reason));
    };
    const onMessage = (event: MessageEvent): void => {
      const parsed = schema.safeParse(JSON.parse(String(event.data)));
      if (!parsed.success) return fail(`Unexpected handshake message: ${parsed.error.message}`);
      cleanup();
      resolve(parsed.data);
    };
    const onClose = (): void => fail('Socket closed during handshake');
    const timer = setTimeout(() => fail('Handshake timed out'), timeoutMs);
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose);
  });

const send = (ws: WebSocket, message: unknown): void => ws.send(JSON.stringify(message));

export const authenticateWithServer = async (ws: WebSocket, instance: InstanceInfo): Promise<HandshakeResult> => {
  const codeIds = (await listCodes()).map((c) => c.id);
  send(ws, { type: MessageType.Hello, instance, codeIds });

  const opening = await nextMessage(ws, ServerOpening);
  if (opening.type === MessageType.Locked) {
    return { outcome: HandshakeOutcome.Locked, reason: opening.reason };
  }

  const record = await findLiveCode(opening.codeId);
  if (!record) throw new Error(`Server asked for unknown or expired code ${opening.codeId}`);
  const { secret } = parsePairCode(record.code);

  const nonce = randomNonce();
  send(ws, { type: MessageType.ExtensionChallenge, nonce });
  const serverProof = await nextMessage(ws, ServerProof);
  if (!proofsMatch(await computeProof(secret, nonce, HandshakeRole.Server), serverProof.proof)) {
    throw new Error('Server failed code verification');
  }

  send(ws, { type: MessageType.ExtensionProof, proof: await computeProof(secret, opening.nonce, HandshakeRole.Extension) });
  await markUsed(record.id);
  return { outcome: HandshakeOutcome.Authenticated };
};
