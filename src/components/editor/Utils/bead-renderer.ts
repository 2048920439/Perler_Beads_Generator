import type { BeadLayer } from '@/common/types';
import type { ColorResolver } from './canvas-types';

export function drawBeadStack(
  context: CanvasRenderingContext2D,
  stack: Array<{ layer: BeadLayer; colorId: string }>,
  left: number,
  top: number,
  cellSize: number,
  resolveColor: ColorResolver,
): void {
  if (stack.length === 0) return;

  const topItem = stack[stack.length - 1];
  const color = resolveColor(topItem.colorId);
  if (!color) return;
  context.globalAlpha = Number.isFinite(topItem.layer.opacity) ? topItem.layer.opacity : 1;
  context.beginPath();
  context.fillStyle = color.hex;
  context.arc(left + cellSize / 2, top + cellSize / 2, cellSize * 0.42, 0, Math.PI * 2);
  context.fill();
  if (isLightColor(color.rgb)) {
    context.strokeStyle = 'rgba(17, 24, 39, 0.22)';
    context.lineWidth = Math.max(1, cellSize * 0.055);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function isLightColor(rgb: [number, number, number]): boolean {
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return luminance > 218;
}

export function drawStackOverlay(
  context: CanvasRenderingContext2D,
  stack: Array<{ layer: BeadLayer; colorId: string }>,
  left: number,
  top: number,
  cellSize: number,
  resolveColor: ColorResolver,
): void {
  const count = stack.length;
  const badgeRadius = Math.max(3.5, Math.min(5.5, cellSize * 0.25));
  const badgeX = left + badgeRadius + 1;
  const badgeY = top + badgeRadius + 1;
  const stripColors = stack.slice(-4);
  const stripWidth = Math.max(2, Math.min(3.2, cellSize * 0.15));
  const stripHeight = cellSize - 6;
  const stripLeft = left + cellSize - stripWidth - 2;
  const stripTop = top + 3;
  const segmentHeight = stripHeight / stripColors.length;

  context.save();
  context.beginPath();
  context.fillStyle = 'rgba(17, 24, 39, 0.72)';
  context.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = `${Math.max(7, badgeRadius * 1.35)}px Arial`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(Math.min(count, 9)), badgeX, badgeY + 0.2);
  if (count > 9) {
    context.beginPath();
    context.fillStyle = '#ffffff';
    context.arc(badgeX + badgeRadius * 0.78, badgeY - badgeRadius * 0.78, Math.max(1, badgeRadius * 0.22), 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = 'rgba(17, 24, 39, 0.42)';
  context.fillRect(stripLeft - 0.5, stripTop - 0.5, stripWidth + 1, stripHeight + 1);
  stripColors.forEach(({ colorId }, index) => {
    const color = resolveColor(colorId);
    if (!color) return;
    context.fillStyle = color.hex;
    context.fillRect(stripLeft, stripTop + index * segmentHeight, stripWidth, Math.ceil(segmentHeight));
  });
  if (count > stripColors.length) {
    context.fillStyle = 'rgba(255, 255, 255, 0.92)';
    context.fillRect(stripLeft, stripTop + stripHeight - Math.max(1, stripHeight * 0.12), stripWidth, Math.max(1, stripHeight * 0.12));
  }
  context.restore();
}

export function drawCellAlert(context: CanvasRenderingContext2D, left: number, top: number, cellSize: number): void {
  const centerX = left + cellSize / 2;
  const centerY = top + cellSize / 2;
  const radius = cellSize * 0.43;
  const badgeRadius = Math.max(4.2, cellSize * 0.23);
  const badgeX = left + cellSize - badgeRadius - 1.4;
  const badgeY = top + badgeRadius + 1.4;
  context.save();
  context.beginPath();
  context.fillStyle = 'rgba(255, 193, 7, 0.28)';
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(185, 58, 50, 0.95)';
  context.lineWidth = Math.max(1.6, cellSize * 0.11);
  context.stroke();
  context.beginPath();
  context.fillStyle = '#b93a32';
  context.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = `${Math.max(8, badgeRadius * 1.65)}px Arial`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('!', badgeX, badgeY + 0.3);
  context.restore();
}

export function readableTextColor(rgb: [number, number, number]): string {
  const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return luminance < 130 ? '#ffffff' : '#111827';
}
