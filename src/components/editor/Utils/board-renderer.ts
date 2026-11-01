import type { BeadProject } from '@/common/types';

export type ReferenceImagePlacement = 'below' | 'above';

export type ReferenceImageRenderOptions = {
  image: HTMLImageElement | null;
  visible: boolean;
  opacity: number;
  scale: number;
  offset: { x: number; y: number };
  placement: ReferenceImagePlacement;
};

export function drawReferenceImage(
  context: CanvasRenderingContext2D,
  project: BeadProject,
  cellSize: number,
  reference: ReferenceImageRenderOptions,
): void {
  if (!reference.image) return;
  const bounds = { x: 0, y: 0, width: project.width, height: project.height };
  if (bounds.width <= 0 || bounds.height <= 0) return;
  context.save();
  context.globalAlpha = Math.max(0.05, Math.min(0.9, reference.opacity));
  context.imageSmoothingEnabled = true;
  const scale = Math.max(0.25, Math.min(3, reference.scale));
  const imageWidth = reference.image.naturalWidth || reference.image.width;
  const imageHeight = reference.image.naturalHeight || reference.image.height;
  const imageRatio = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : bounds.width / bounds.height;
  const boundsRatio = bounds.width / bounds.height;
  const fitWidth = imageRatio >= boundsRatio ? bounds.width : bounds.height * imageRatio;
  const fitHeight = imageRatio >= boundsRatio ? bounds.width / imageRatio : bounds.height;
  const drawWidth = fitWidth * scale;
  const drawHeight = fitHeight * scale;
  const drawX = bounds.x + (bounds.width - drawWidth) / 2 + reference.offset.x;
  const drawY = bounds.y + (bounds.height - drawHeight) / 2 + reference.offset.y;
  context.drawImage(reference.image, drawX * cellSize, drawY * cellSize, drawWidth * cellSize, drawHeight * cellSize);
  context.restore();
}

export function drawGrid(context: CanvasRenderingContext2D, project: BeadProject, cellSize: number): void {
  context.strokeStyle = '#d6d3cc';
  context.lineWidth = 1;
  for (let x = 0; x <= project.width; x += 1) {
    context.beginPath();
    context.moveTo(x * cellSize, 0);
    context.lineTo(x * cellSize, project.height * cellSize);
    context.stroke();
  }
  for (let y = 0; y <= project.height; y += 1) {
    context.beginPath();
    context.moveTo(0, y * cellSize);
    context.lineTo(project.width * cellSize, y * cellSize);
    context.stroke();
  }
}

export function drawCoordinates(context: CanvasRenderingContext2D, project: BeadProject, cellSize: number): void {
  context.fillStyle = 'rgba(17,24,39,0.45)';
  context.font = '8px Arial';
  context.textAlign = 'left';
  context.textBaseline = 'top';
  for (let x = 0; x < project.width; x += 5) context.fillText(String(x + 1), x * cellSize + 2, 2);
  for (let y = 0; y < project.height; y += 5) context.fillText(String(y + 1), 2, y * cellSize + 2);
}

export function drawPegboardBoundaries(context: CanvasRenderingContext2D, project: BeadProject, cellSize: number): void {
  const verticalGuides = guideLineCenters(project.width, project.boardSettings.boardWidth, cellSize);
  const horizontalGuides = guideLineCenters(project.height, project.boardSettings.boardHeight, cellSize);
  context.save();
  context.strokeStyle = 'rgba(54, 102, 108, 0.32)';
  context.lineWidth = 1.25;
  verticalGuides.forEach((x, index) => {
    context.setLineDash(index % 2 === 0 ? [] : [4, 6]);
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, project.height * cellSize);
    context.stroke();
  });
  horizontalGuides.forEach((y, index) => {
    context.setLineDash(index % 2 === 0 ? [] : [4, 6]);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(project.width * cellSize, y);
    context.stroke();
  });
  context.setLineDash([]);
  context.restore();
}

function guideLineCenters(totalCells: number, boardCells: number, cellSize: number): number[] {
  const centers = new Set<number>();
  const boardSize = Math.max(1, boardCells);
  for (let boardStart = 0; boardStart < totalCells; boardStart += boardSize) {
    const segmentLength = Math.min(boardSize, totalCells - boardStart);
    for (let offset = 1; offset < segmentLength; offset += 5) centers.add((boardStart + offset) * cellSize);
    if (segmentLength > 1) centers.add((boardStart + segmentLength - 1) * cellSize);
  }
  return [...centers].sort((a, b) => a - b);
}
