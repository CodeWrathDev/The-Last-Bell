const deep = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : deep()), apply: () => 1, construct: () => deep() });
export class Howl { constructor() { return deep(); } }
export const Howler = deep();
