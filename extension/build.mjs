import { build } from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = (name) => path.join(dir, 'src', name);

await build({
  entryPoints: [src('background.ts'), src('popup.ts'), src('offscreen.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome125',
  outdir: path.join(dir, 'dist'),
  minify: true,
  logLevel: 'info',
});
