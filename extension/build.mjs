import { build } from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(dir, 'src', 'background.ts'), path.join(dir, 'src', 'popup.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome125',
  outdir: path.join(dir, 'dist'),
  minify: true,
  logLevel: 'info',
});
