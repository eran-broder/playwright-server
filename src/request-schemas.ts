import { z } from 'zod';
import { SnapshotMode, WaitUntil } from './types';
import { ViewportMode } from './viewport';

const zSelector = z.string().min(1);
const zCode = z.object({ code: z.string() });
const zClockTime = z.union([z.number(), z.string()]);
const zQueryBool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();
const zQueryNumber = z.coerce.number().optional();
const zQueryList = z
  .string()
  .transform((v) => v.split(','))
  .optional();

export const BrowserStartBody = z.object({
  device: z.string().optional(),
  viewport: z.enum(ViewportMode).optional(),
  profile: z.string().optional(),
  window: z.coerce.number().int().optional(),
  tab: z.coerce.number().int().optional(),
});
export type BrowserStartBody = z.infer<typeof BrowserStartBody>;

export const NavigateBody = z.object({
  url: z.string().min(1),
  waitUntil: z.enum(WaitUntil).optional(),
});

export const HistoryBody = z.object({
  waitUntil: z.enum(WaitUntil).optional(),
});

export const ScreenshotBody = z.object({
  name: z.string().optional(),
  fullPage: z.boolean().default(true),
});

export const CodeBody = zCode;
export const SaveScriptBody = z.object({ name: z.string().min(1), code: z.string() });
export const ScriptNameBody = z.object({ name: z.string().min(1) });

export const ClickBody = z.object({ selector: zSelector });
export const TypeBody = z.object({ selector: zSelector, text: z.string() });
export const WaitBody = z.object({ selector: zSelector, timeout: z.number().default(30000) });
export const SelectBody = z.object({ selector: zSelector, value: z.string() });
export const HoverBody = z.object({ selector: zSelector });
export const ScrollBody = z.object({ x: z.number().default(0), y: z.number().default(0) });
export const KeyboardBody = z.object({ key: z.string().min(1) });

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

export const SwitchPageBody = z.object({ index: z.coerce.number().int().min(0) });

export const ActivityStartBody = z.object({ captureNetworkBodies: z.boolean().default(false) });
export const ActivityConfigBody = z.object({ autoStart: z.boolean().optional() });
export const ActivityQuery = z.object({
  since: zQueryNumber,
  types: zQueryList,
  limit: zQueryNumber,
});
