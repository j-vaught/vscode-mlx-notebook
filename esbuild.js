const esbuild = require('esbuild');

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

if (watch) {
  Promise.all([
    esbuild.context(opts).then(ctx => ctx.watch()),
    esbuild.context(rendererOpts).then(ctx => ctx.watch()),
  ]);
} else {
  Promise.all([
    esbuild.build(opts),
    esbuild.build(rendererOpts),
  ]).catch(() => process.exit(1));
}
