export enum ViewportMode {
  Emulated = 'emulated',
  Window = 'window',
}

const isViewportMode = (s: string): s is ViewportMode =>
  (Object.values(ViewportMode) as string[]).includes(s);

export const parseViewportMode = (s: string | undefined): ViewportMode => {
  if (!s) return ViewportMode.Emulated;
  if (!isViewportMode(s)) {
    throw new Error(`Invalid viewport mode: ${s}. Use emulated or window.`);
  }
  return s;
};
