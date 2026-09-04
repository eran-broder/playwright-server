import { z } from 'zod';
import { SnapshotMode, WaitUntil } from './types';
import { ViewportMode } from './viewport';

export const BrowserStartBody = z.object({
  device: z.string().optional(),
  viewport: z.enum(ViewportMode).optional(),
});

const zClockTime = z.union([z.number(), z.string()]);
const zQueryBool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const NavigateBody = z.object({
  url: z.string().min(1),
  waitUntil: z.enum(WaitUntil).optional(),
});

export const HistoryBody = z.object({
  waitUntil: z.enum(WaitUntil).optional(),
});

export const SnapshotQuery = z.object({
  selector: z.string().optional(),
  mode: z.enum(SnapshotMode).optional(),
  refs: zQueryBool,
  boxes: zQueryBool,
  depth: z.coerce.number().int().positive().optional(),
});

export const CdpBody = z.object({
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const TraceStartBody = z.object({
  screenshots: z.boolean().optional(),
  snapshots: z.boolean().optional(),
});

export const ClockSetBody = z.object({ time: zClockTime });
export const ClockInstallBody = z.object({ time: zClockTime.optional() });
export const ClockFastForwardBody = z.object({ ticks: zClockTime });
