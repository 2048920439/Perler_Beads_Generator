import type { BeadLayer, BeadProject, ClipboardPattern, CopyMode, MoveMode, RemoveMode, TextDirection, ToolId } from '@/common/types';
import { drawCoordinates, drawGrid, drawPegboardBoundaries, drawReferenceImage, type ReferenceImageRenderOptions } from './board-renderer';
import { drawBeadStack, drawCellAlert, drawStackOverlay, readableTextColor } from './bead-renderer';
import type { ColorResolver, PointerGridPoint, ShapeDraft } from './canvas-types';
import { drawCopySelectionSet } from './selection-renderer';
import { collectShapeIndices } from './shape-rasterizer';
import { drawBrushCursor, drawShapePreview, drawToolImpactPreview } from './tool-preview-renderer';

export function drawPattern(
  context: CanvasRenderingContext2D,
  project: BeadProject,
  cellSize: number,
  zoom: number,
  pan: { x: number; y: number },
  highlightedColorId: string | null,
  highlightedCellIndices: number[],
  tool: ToolId,
  selectedColorId: string,
  eraserSize: number,
  moveMode: MoveMode,
  removeMode: RemoveMode,
  mirrorMode: MoveMode,
  clipboardPattern: ClipboardPattern | null,
  copyMode: CopyMode,
  copySelectionIndices: number[],
  shapeDraft: ShapeDraft | null,
  hoverPoint: PointerGridPoint | null,
  canEdit: boolean,
  referenceImage: ReferenceImageRenderOptions,
  textToolValue: string,
  textToolDirection: TextDirection,
  textToolSize: number,
  textToolSpacing: number,
  resolveColor: ColorResolver,
  formatColorCode?: (colorId: string) => string,
): void {
  const canvasWidth = context.canvas.width / (window.devicePixelRatio || 1);
  const canvasHeight = context.canvas.height / (window.devicePixelRatio || 1);
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = '#f3f0e8';
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.save();
  context.translate(pan.x, pan.y);
  context.scale(zoom, zoom);
  context.fillStyle = '#fffdf7';
  context.fillRect(0, 0, project.width * cellSize, project.height * cellSize);
  const visibleLayers = (project.layers ?? []).filter((layer) => layer.visible);
  const highlightedCells = highlightedCellIndices.length > 0 ? new Set(highlightedCellIndices) : null;
  if (referenceImage.visible && referenceImage.placement === 'below') {
    drawReferenceImage(context, project, cellSize, referenceImage);
  }

  for (let y = 0; y < project.height; y += 1) {
    for (let x = 0; x < project.width; x += 1) {
      const index = y * project.width + x;
      const stack = visibleLayers
        .map((layer) => ({ layer, colorId: layer.cells?.[index] }))
        .filter((item): item is { layer: BeadLayer; colorId: string } => Boolean(item.colorId));
      const topColorId = stack.length > 0 ? stack[stack.length - 1].colorId : null;
      const topColor = resolveColor(topColorId);
      const left = x * cellSize;
      const top = y * cellSize;

      if (project.settings.beadDisplayMode === 'bead') {
        drawBeadStack(context, stack, left, top, cellSize, resolveColor);
      } else if (topColor) {
        context.fillStyle = topColor.hex;
        context.fillRect(left, top, cellSize, cellSize);
      }

      if (stack.length > 1 && project.settings.showLayerOverlap) {
        drawStackOverlay(context, stack, left, top, cellSize, resolveColor);
      }

      if (highlightedColorId && topColorId !== highlightedColorId) {
        context.fillStyle = 'rgba(255, 255, 255, 0.72)';
        context.fillRect(left, top, cellSize, cellSize);
      }

      if (highlightedCells?.has(index) && topColorId) {
        drawCellAlert(context, left, top, cellSize);
      }

      if (project.settings.showColorCodes && topColor && cellSize >= 16) {
        context.fillStyle = readableTextColor(topColor.rgb);
        context.font = `${Math.max(7, cellSize * 0.3)}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(formatColorCode?.(topColor.id) ?? topColor.primaryCode, left + cellSize / 2, top + cellSize / 2);
      }
    }
  }

  if (referenceImage.visible && referenceImage.placement === 'above') {
    drawReferenceImage(context, project, cellSize, referenceImage);
  }

  if (tool === 'copy' && copyMode === 'selection' && copySelectionIndices.length > 0) {
    drawCopySelectionSet(context, copySelectionIndices, project.width, cellSize);
  }
  if (hoverPoint && (canEdit || tool === 'eyedropper' || tool === 'copy')) {
    drawToolImpactPreview(context, project, tool, selectedColorId, hoverPoint, eraserSize, moveMode, removeMode, mirrorMode, clipboardPattern, copyMode, copySelectionIndices, textToolValue, textToolDirection, textToolSize, textToolSpacing, cellSize, resolveColor);
  }
  if (shapeDraft && canEdit) {
    const indices = collectShapeIndices(shapeDraft.kind, shapeDraft.fillMode, shapeDraft.arrowKind, shapeDraft.start, shapeDraft.end, project.width, project.height);
    drawShapePreview(context, indices, project.width, cellSize, selectedColorId, resolveColor);
  } else if (tool === 'shape' && hoverPoint?.cell && canEdit) {
    const index = hoverPoint.cell.y * project.width + hoverPoint.cell.x;
    drawShapePreview(context, [index], project.width, cellSize, selectedColorId, resolveColor);
  }
  if (project.settings.showGrid) drawGrid(context, project, cellSize);
  if (project.settings.showPegboardBoundaries) drawPegboardBoundaries(context, project, cellSize);
  if (project.settings.showCoordinates && cellSize * zoom > 10) drawCoordinates(context, project, cellSize);
  if (tool === 'eraser' && hoverPoint && canEdit && eraserSize > 0) {
    drawBrushCursor(context, hoverPoint.gridX, hoverPoint.gridY, eraserSize, cellSize);
  }
  context.restore();
}
