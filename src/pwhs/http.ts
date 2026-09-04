import { z } from 'zod';
import { LockReason, WindowInfo } from '../extension/protocol';

export enum HttpMethod {
  Get = 'GET',
  Post = 'POST',
}

const SuccessBase = z.object({ success: z.boolean() });

export const ProfileInfo = z.object({
  id: z.string(),
  shortId: z.string(),
  label: z.string(),
  authenticated: z.boolean(),
  lockReason: z.enum(LockReason).nullable(),
  brand: z.string(),
  version: z.string(),
  windows: z.array(WindowInfo),
});
export type ProfileInfo = z.infer<typeof ProfileInfo>;

export const NavigateResponse = SuccessBase.extend({ url: z.string() });
export const UrlResponse = SuccessBase.extend({ url: z.string() });
export const TitleResponse = SuccessBase.extend({ title: z.string() });
export const ContentResponse = SuccessBase.extend({ content: z.string() });
export const SnapshotResponse = SuccessBase.extend({ snapshot: z.string() });
export const ScreenshotResponse = SuccessBase.extend({
  filename: z.string(),
  path: z.string(),
});
export const ScreenshotsResponse = SuccessBase.extend({ screenshots: z.array(z.unknown()) });
export const ResultResponse = SuccessBase.extend({ result: z.unknown().optional() });
export const TraceStopResponse = SuccessBase.extend({ path: z.string() });
export const PagesResponse = SuccessBase.extend({ pages: z.array(z.unknown()) });
export const ProfilesResponse = SuccessBase.extend({
  relayPort: z.number(),
  profiles: z.array(ProfileInfo),
});
export const PassthroughResponse = z.unknown();

export const request = async <S extends z.ZodType>(
  port: number,
  method: HttpMethod,
  apiPath: string,
  body: unknown,
  schema: S,
): Promise<z.infer<S>> => {
  const init: RequestInit = { method };
  if (method === HttpMethod.Post) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body ?? {});
  }
  const response = await fetch(`http://localhost:${port}${apiPath}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${apiPath}: ${text}`);
  }
  return schema.parse(JSON.parse(text));
};
