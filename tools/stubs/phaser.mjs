const deep = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : k === Symbol.iterator ? undefined : deep()),
  apply: () => deep(), construct: () => deep(), set: () => true,
});
class Scene {
  constructor(key) {
    return new Proxy(this, {
      get: (t, p, r) => { if (p in t) return Reflect.get(t, p, r); if (typeof p === 'symbol') return undefined; return (t[p] = deep()); },
      set: (t, p, v) => { t[p] = v; return true; },
    });
  }
}
const Phaser = { Scene, AUTO: 0, WEBGL: 2, Math: { Clamp: (v, a, b) => Math.max(a, Math.min(b, v)) }, BlendModes: { ADD: 1 }, Textures: { FilterMode: { NEAREST: 1 } }, Scale: { FIT: 1, CENTER_BOTH: 1 }, Game: class {} };
export default Phaser;
