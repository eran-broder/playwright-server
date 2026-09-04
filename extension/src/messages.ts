import { z } from 'zod';

export enum PopupRequestType {
  Status = 'status',
  Connect = 'connect',
}

export const PopupRequest = z.object({ type: z.enum(PopupRequestType) });
export type PopupRequest = z.infer<typeof PopupRequest>;

export const PopupResponse = z.object({
  instanceId: z.string(),
  connections: z.array(z.object({ port: z.number() })),
});
export type PopupResponse = z.infer<typeof PopupResponse>;
