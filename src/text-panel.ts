import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';

export interface TextPanelStyle {
  bg: string;
  fg: string;
  border?: string;
  fontSize?: number; // px on the canvas
  align?: CanvasTextAlign;
  bold?: boolean;
  radius?: number;
}

const PX_PER_METER = 1400;

/** A flat rounded panel whose text is drawn on a canvas texture. */
export class TextPanel {
  readonly mesh: Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: CanvasTexture;
  private lastText = '';

  constructor(
    readonly width: number,
    readonly height: number,
    private style: TextPanelStyle,
    text = '',
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(8, Math.round(width * PX_PER_METER));
    this.canvas.height = Math.max(8, Math.round(height * PX_PER_METER));
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    const mat = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      toneMapped: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(width, height), mat);
    this.setText(text, true);
  }

  setStyle(style: Partial<TextPanelStyle>): void {
    this.style = { ...this.style, ...style };
    this.setText(this.lastText, true);
  }

  setText(text: string, force = false): void {
    if (!force && text === this.lastText) return;
    this.lastText = text;
    const { ctx, canvas, style } = this;
    const w = canvas.width;
    const h = canvas.height;
    const r = Math.min(style.radius ?? 24, h / 2 - 4);
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, r);
    ctx.fillStyle = style.bg;
    ctx.fill();
    if (style.border) {
      ctx.lineWidth = 6;
      ctx.strokeStyle = style.border;
      ctx.stroke();
    }
    const lines = text.split('\n');
    const size =
      style.fontSize ?? Math.round(Math.min(h * 0.42, (h * 0.8) / lines.length));
    ctx.font = `${style.bold ? '700' : '500'} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = style.fg;
    ctx.textAlign = style.align ?? 'center';
    ctx.textBaseline = 'middle';
    const lh = size * 1.3;
    const x = ctx.textAlign === 'left' ? size * 0.7 : w / 2;
    const y0 = h / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => ctx.fillText(line, x, y0 + i * lh, w - size * 1.2));
    this.texture.needsUpdate = true;
  }
}
