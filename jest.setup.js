const { HTMLCanvasElement } = window;

if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
}
if (!global.cancelAnimationFrame) {
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}

if (HTMLCanvasElement && !HTMLCanvasElement.prototype.getBoundingClientRect) {
  HTMLCanvasElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.width || 0,
      height: this.height || 0,
      right: this.width || 0,
      bottom: this.height || 0,
    };
  };
}
