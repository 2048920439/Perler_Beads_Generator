import type { TextDirection } from '@/common/types';
import { uniqueInBounds } from './grid-geometry';

type TextGlyph = {
  points: Array<{ x: number; y: number }>;
  width: number;
  height: number;
};

const textPatternCache = new Map<string, Array<{ x: number; y: number }>>();

const textGlyphCache = new Map<string, TextGlyph>();

export function collectTextIndices(
  value: string,
  direction: TextDirection,
  size: number,
  spacing: number,
  startX: number,
  startY: number,
  width: number,
  height: number,
): number[] {
  const points = rasterizeTextPoints(value, direction, size, spacing).map((point) => ({
    x: startX + point.x,
    y: startY + point.y,
  }));
  return uniqueInBounds(points, width, height);
}

function rasterizeTextPoints(value: string, direction: TextDirection, size: number, spacing: number): Array<{ x: number; y: number }> {
  const text = value.trim().length > 0 ? value : 'ABC';
  const normalizedText = text.replace(/\r/g, '');
  const normalizedSpacing = Math.max(0, Math.round(spacing));
  const key = `${direction}:${size}:${normalizedSpacing}:${normalizedText}`;
  const cached = textPatternCache.get(key);
  if (cached) return cached;

  const points: Array<{ x: number; y: number }> = [];
  if (direction === 'vertical') {
    let yCursor = 0;
    Array.from(normalizedText.replace(/\n/g, '')).forEach((char) => {
      const glyph = rasterizeTextGlyph(char, size);
      glyph.points.forEach((point) => points.push({ x: point.x, y: yCursor + point.y }));
      yCursor += glyphVisibleHeight(glyph) + normalizedSpacing;
    });
  } else {
    let yCursor = 0;
    normalizedText.split('\n').forEach((line) => {
      let xCursor = 0;
      let lineHeight = size;
      Array.from(line.length > 0 ? line : ' ').forEach((char) => {
        const glyph = rasterizeTextGlyph(char, size);
        glyph.points.forEach((point) => points.push({ x: xCursor + point.x, y: yCursor + point.y }));
        xCursor += glyph.width + normalizedSpacing;
        lineHeight = Math.max(lineHeight, glyph.height);
      });
      yCursor += lineHeight + normalizedSpacing;
    });
  }

  if (textPatternCache.size > 80) textPatternCache.clear();
  textPatternCache.set(key, points);
  return points;
}

function rasterizeTextGlyph(char: string, size: number): TextGlyph {
  const normalizedSize = Math.max(5, Math.round(size));
  if (char === ' ') {
    return { points: [], width: Math.max(2, Math.round(normalizedSize * 0.45)), height: normalizedSize };
  }
  const key = `${normalizedSize}:${char}`;
  const cached = textGlyphCache.get(key);
  if (cached) return cached;
  const cellPixel = 5;
  const fontSize = Math.max(16, Math.round(normalizedSize * cellPixel));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return { points: [], width: normalizedSize, height: normalizedSize };

  const font = `500 ${fontSize}px Arial, "Microsoft YaHei", "PingFang SC", sans-serif`;
  context.font = font;
  const metrics = context.measureText(char);
  const padding = cellPixel * 3;
  canvas.width = Math.max(cellPixel * 2, Math.ceil(metrics.width + padding * 2));
  canvas.height = Math.max(cellPixel * 2, Math.ceil(fontSize * 1.32 + padding * 2));

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = font;
  context.fillStyle = '#ffffff';
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillText(char, padding, padding + fontSize);

  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const cols = Math.ceil(canvas.width / cellPixel);
  const rows = Math.ceil(canvas.height / cellPixel);
  const raw: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let alphaTotal = 0;
      let samples = 0;
      const fromX = col * cellPixel;
      const fromY = row * cellPixel;
      const toX = Math.min(canvas.width, fromX + cellPixel);
      const toY = Math.min(canvas.height, fromY + cellPixel);
      for (let y = fromY; y < toY; y += 1) {
        for (let x = fromX; x < toX; x += 1) {
          alphaTotal += data[(y * canvas.width + x) * 4 + 3];
          samples += 1;
        }
      }
      if (samples > 0 && alphaTotal / (samples * 255) > 0.3) raw.push({ x: col, y: row });
    }
  }

  if (raw.length === 0) {
    return { points: [], width: Math.max(1, Math.ceil(metrics.width / cellPixel)), height: normalizedSize };
  }
  const minX = Math.min(...raw.map((point) => point.x));
  const maxX = Math.max(...raw.map((point) => point.x));
  const lineTop = Math.max(0, Math.floor(padding / cellPixel));
  const points = raw
    .map((point) => ({ x: point.x - minX, y: point.y - lineTop }))
    .filter((point) => point.y >= 0);
  const glyphHeight = Math.max(normalizedSize + 2, ...points.map((point) => point.y + 1));
  const glyph = { points, width: maxX - minX + 1, height: glyphHeight };
  if (textGlyphCache.size > 160) textGlyphCache.clear();
  textGlyphCache.set(key, glyph);
  return glyph;
}

function glyphVisibleHeight(glyph: TextGlyph): number {
  if (glyph.points.length === 0) return glyph.height;
  const minY = Math.min(...glyph.points.map((point) => point.y));
  const maxY = Math.max(...glyph.points.map((point) => point.y));
  return Math.max(1, maxY - minY + 1);
}
