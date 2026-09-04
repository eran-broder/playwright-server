import { z } from 'zod';

export const CdpCommand = z.object({
  id: z.number(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().optional(),
});
export type CdpCommand = z.infer<typeof CdpCommand>;

export enum CdpErrorCode {
  ServerError = -32000,
  MethodNotFound = -32601,
}

export interface CdpError {
  code: CdpErrorCode;
  message: string;
}

export type CdpOutbound =
  | { id: number; sessionId?: string; result: unknown }
  | { id: number; sessionId?: string; error: CdpError }
  | { sessionId?: string; method: string; params: unknown };

const withSession = (sessionId?: string): { sessionId?: string } =>
  sessionId ? { sessionId } : {};

export const cdpResult = (cmd: CdpCommand, result: unknown): CdpOutbound => ({
  id: cmd.id,
  ...withSession(cmd.sessionId),
  result: result ?? {},
});

export const cdpError = (cmd: CdpCommand, code: CdpErrorCode, message: string): CdpOutbound => ({
  id: cmd.id,
  ...withSession(cmd.sessionId),
  error: { code, message },
});

export const cdpEvent = (method: string, params: unknown, sessionId?: string): CdpOutbound => ({
  ...withSession(sessionId),
  method,
  params,
});

export const domainOf = (method: string): string => method.split('.')[0];

export enum CdpDomain {
  Browser = 'Browser',
  Target = 'Target',
}
