const here = (f) => new URL(f, import.meta.url).href;
export async function resolve(spec, ctx, next) {
  if (spec === 'phaser') return { url: here('./phaser.mjs'), shortCircuit: true };
  if (spec === 'howler') return { url: here('./howler.mjs'), shortCircuit: true };
  if (spec.endsWith('render3d/View3D.js')) return { url: here('./view3d.mjs'), shortCircuit: true };
  return next(spec, ctx);
}
