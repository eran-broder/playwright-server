import { z } from 'zod';
import {
  HandshakeRole,
  InstanceInfo,
  MessageType,
  ServerChallenge,
  ServerProof,
} from '../../src/extension/protocol';
import { computeProof, proofsMatch, randomNonce } from '../../src/extension/hmac';

const HANDSHAKE_TIMEOUT_MS = 5_000;

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

export const authenticateWithServer = async (
  ws: WebSocket,
  token: string,
  instance: InstanceInfo,
): Promise<void> => {
  const serverChallenge = await nextMessage(ws, ServerChallenge);
  const nonce = randomNonce();
  ws.send(JSON.stringify({ type: MessageType.ExtensionChallenge, nonce }));

  const serverProof = await nextMessage(ws, ServerProof);
  const expected = await computeProof(token, nonce, HandshakeRole.Server);
  if (!proofsMatch(expected, serverProof.proof)) {
    throw new Error('Server failed token verification');
  }

  const proof = await computeProof(token, serverChallenge.nonce, HandshakeRole.Extension);
  ws.send(JSON.stringify({ type: MessageType.ExtensionProof, proof, instance }));
};
