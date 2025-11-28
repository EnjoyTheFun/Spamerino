import { build } from 'esbuild';
import { rm, mkdir, cp } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const srcDir = resolve(root, 'src');
const outdir = resolve(root, 'dist');

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [
    resolve(srcDir, 'popup/index.ts'),
    resolve(srcDir, 'content/index.ts'),
    resolve(srcDir, 'content/bridge.ts')
  ],
  outdir,
  bundle: true,
  format: 'esm',
  target: ['es2020'],
  sourcemap: true,
  loader: {
    '.css': 'text',
  },
});

await cp(resolve(root, 'manifest.json'), resolve(outdir, 'manifest.json'));
await mkdir(resolve(outdir, 'popup'), { recursive: true });
await cp(resolve(srcDir, 'popup/index.html'), resolve(outdir, 'popup/index.html'));
await cp(resolve(srcDir, 'popup/style.css'), resolve(outdir, 'popup/style.css'));

// Copy icons
await mkdir(resolve(outdir, 'icons'), { recursive: true });
await cp(resolve(srcDir, 'icons'), resolve(outdir, 'icons'), { recursive: true });

console.log('Built to', outdir);
