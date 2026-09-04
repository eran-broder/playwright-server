import type { WebSocket, RawData } from 'ws';
import { z } from 'zod';

const rawToString = (data: RawData): string =>
  Array.isArray(data) ? Buffer.concat(data).toString('utf-8') : data.toString();

export const parseJson = (data: RawData): unknown => JSON.parse(rawToString(data));

export const sendJson = (ws: WebSocket, message: unknown): void => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
};

export const nextMessage = <S extends z.ZodType>(
  ws: WebSocket,
  schema: S,
  timeoutMs: number,
): Promise<z.infer<S>> =>
  new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timer);
      ws.off('message', onMessage);
      ws.off('close', onClose);
    };
    const fail = (reason: string): void => {
      cleanup();
      reject(new Error(reason));
    };
    const onMessage = (data: RawData): void => {
      const parsed = schema.safeParse(parseJson(data));
      if (!parsed.success) return fail(`Unexpected handshake message: ${parsed.error.message}`);
      cleanup();
      resolve(parsed.data);
    };
    const onClose = (): void => fail('Socket closed during handshake');
    const timer = setTimeout(() => fail('Handshake timed out'), timeoutMs);
    ws.on('message', onMessage);
    ws.on('close', onClose);
  });
