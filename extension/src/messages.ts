import { z } from 'zod';
import { LockReason } from '../../src/extension/protocol';
import { CodeTtl } from './codes';
import { PairCodeRecord } from './settings';

export enum PopupRequestType {
  Status = 'status',
  Connect = 'connect',
  MintCode = 'mintCode',
  RevokeCode = 'revokeCode',
  RevokeAll = 'revokeAll',
  SetLabel = 'setLabel',
}

export enum WorkerMessageType {
  Keepalive = 'keepalive',
}

export const PopupRequest = z.discriminatedUnion('type', [
  z.object({ type: z.literal(PopupRequestType.Status) }),
  z.object({ type: z.literal(PopupRequestType.Connect) }),
  z.object({ type: z.literal(PopupRequestType.MintCode), ttl: z.enum(CodeTtl), name: z.string() }),
  z.object({ type: z.literal(PopupRequestType.RevokeCode), id: z.string() }),
  z.object({ type: z.literal(PopupRequestType.RevokeAll) }),
  z.object({ type: z.literal(PopupRequestType.SetLabel), label: z.string() }),
]);
export type PopupRequest = z.infer<typeof PopupRequest>;

export const KeepaliveMessage = z.object({ type: z.literal(WorkerMessageType.Keepalive) });

export const PopupResponse = z.object({
  profileId: z.string(),
  label: z.string(),
  brand: z.string(),
  version: z.string(),
  connections: z.array(z.object({
    port: z.number(),
    authenticated: z.boolean(),
    lockReason: z.enum(LockReason).optional(),
    attachedTabs: z.number(),
  })),
  codes: z.array(PairCodeRecord),
  minted: PairCodeRecord.optional(),
});
export type PopupResponse = z.infer<typeof PopupResponse>;
