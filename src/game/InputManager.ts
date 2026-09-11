export class InputManager {
  keys = new Set<string>();
  pressed = new Set<string>();
  mouse = { x: 0, y: 0, active: false };
  attack = false;
  block = false;
  enabled = false;
  constructor(canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'F3', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
        e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    canvas.addEventListener('pointerdown', (e) => {
      if (this.enabled) {
        if (e.button === 0) this.attack = true;
        if (e.button === 2) this.block = true;
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.attack = false;
      if (e.button === 2) this.block = false;
    });
    canvas.addEventListener('pointermove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = 1 - (e.clientY / window.innerHeight) * 2;
      this.mouse.active = true;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(...codes: string[]) {
    return codes.some((code) => this.keys.has(code));
  }
  consume(code: string) {
    const value = this.pressed.has(code);
    this.pressed.delete(code);
    return value;
  }
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.attack = false;
    this.block = false;
  }
  endFrame() {
    this.pressed.clear();
  }
}
