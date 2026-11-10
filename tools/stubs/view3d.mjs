export class View3D { constructor() { this.rig = { heading: 0 }; } enterMap() {} mapChanged() {} step() {} moveInput(dt, ctl) { return { vx: ctl.vx, vy: ctl.vy }; } }
