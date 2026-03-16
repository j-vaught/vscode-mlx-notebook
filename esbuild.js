const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const opts = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  sourcemap: true,
  minify: !watch,
};

/** @type {import('esbuild').BuildOptions} */
const rendererOpts = {
  entryPoints: ['src/renderer.ts'],
  bundle: true,
  outfile: 'dist/renderer.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  minify: !watch,
};

// Copy non-JS assets that need to live alongside the bundle
function copyAssets() {
  fs.mkdirSync('dist', { recursive: true });
  fs.copyFileSync(
    path.join('src', 'engine', 'matlab_bridge.py'),
    path.join('dist', 'matlab_bridge.py')
  );
}

if (watch) {
  copyAssets();
  Promise.all([
    esbuild.context(opts).then(ctx => ctx.watch()),
    esbuild.context(rendererOpts).then(ctx => ctx.watch()),
  ]);
} else {
  copyAssets();
  Promise.all([
    esbuild.build(opts),
    esbuild.build(rendererOpts),
  ]).catch(() => process.exit(1));
}
