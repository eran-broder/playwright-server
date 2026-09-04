import { build } from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = (name) => path.join(dir, 'src', name);

const common = {
  bundle: true,
  platform: 'browser',
  target: 'chrome125',
  outdir: path.join(dir, 'dist'),
  minify: true,
  logLevel: 'info',
};

await build({ ...common, format: 'esm', entryPoints: [src('background.ts'), src('popup.ts')] });
await build({ ...common, format: 'iife', entryPoints: [src('pair.ts')] });
