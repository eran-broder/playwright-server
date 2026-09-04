export enum ViewportMode {
  Emulated = 'emulated',
  Window = 'window',
}

export const EMULATED_VIEWPORT = { width: 1280, height: 720 } as const;

const isViewportMode = (s: string): s is ViewportMode =>
  (Object.values(ViewportMode) as string[]).includes(s);

export const parseViewportMode = (s: string | undefined): ViewportMode | undefined => {
  if (!s) return undefined;
  if (!isViewportMode(s)) {
    throw new Error(`Invalid viewport mode: ${s}. Use emulated or window.`);
  }
  return s;
};
