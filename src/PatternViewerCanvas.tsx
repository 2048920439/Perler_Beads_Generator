import * as React from 'react';
import { getColor } from './palette';
import type { BeadProject } from './types';

type Props = {
  project: BeadProject;
  highlightedColorIds: Set<string>;
  flipHorizontal: boolean;
  flipVertical: boolean;
  settings: {
    beadDisplayMode: 'bead' | 'pixel';
    showGrid: boolean;
    showCoordinates: boolean;
    showColorCodes: boolean;
    showLayerOverlap: boolean;
  };
  onHover: (cell: { x: number; y: number; colorId: string | null } | null) => void;
  fitLabel: string;
};

const CELL_SIZE = 18;

type VisibleCell = {
  stack: string[];
  topColorId: string | null;
};

export default function PatternViewerCanvas({
  project,
  highlightedColorIds,
  flipHorizontal,
  flipVertical,
  settings,
  onHover,
  fitLabel,
}: Props) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const pointerRef = React.useRef({ active: false, pointerId: 0, lastX: 0, lastY: 0 });
  const hoverKeyRef = React.useRef<string | null>(null);
  const visibleCells = React.useMemo(() => buildVisibleCells(project), [project]);

  const fitToWindow = React.useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const availableWidth = Math.max(120, wrapper.clientWidth - 32);
    const availableHeight = Math.max(120, wrapper.clientHeight - 32);
    const patternWidth = Math.max(1, project.width * CELL_SIZE);
    const patternHeight = Math.max(1, project.height * CELL_SIZE);
    const nextZoom = clamp(Math.min(availableWidth / patternWidth, availableHeight / patternHeight), 0.1, 4);
    setZoom(nextZoom);
    setPan({ x: 0, y: 0 });
  }, [project.width, project.height]);

  React.useEffect(() => {
    fitToWindow();
  }, [fitToWindow]);

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => fitToWindow());
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [fitToWindow]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, wrapper.clientWidth);
    const height = Math.max(1, wrapper.clientHeight);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawViewerPattern(context, project, width, height, zoom, pan, highlightedColorIds, flipHorizontal, flipVertical, visibleCells, settings);
  }, [project, visibleCells, zoom, pan, highlightedColorIds, flipHorizontal, flipVertical, settings]);

  function updateHover(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getHoverCell(
      event.clientX,
      event.clientY,
      canvasRef.current,
      project,
      zoom,
      pan,
      flipHorizontal,
      flipVertical,
      visibleCells,
    );
    const nextKey = point ? `${point.x}:${point.y}:${point.colorId ?? ''}` : null;
    if (nextKey === hoverKeyRef.current) return;
    hoverKeyRef.current = nextKey;
    onHover(point);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    updateHover(event);
    pointerRef.current = {
      active: true,
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    updateHover(event);
    if (!pointerRef.current.active) return;
    const dx = event.clientX - pointerRef.current.lastX;
    const dy = event.clientY - pointerRef.current.lastY;
    pointerRef.current.lastX = event.clientX;
    pointerRef.current.lastY = event.clientY;
    setPan((current) => ({ x: current.x + dx, y: current.y + dy }));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    pointerRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerLeave() {
    if (!pointerRef.current.active) {
      hoverKeyRef.current = null;
      onHover(null);
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    setZoom((current) => clamp(current * (event.deltaY > 0 ? 0.9 : 1.1), 0.1, 4));
  }

  return (
    <div className="pattern-viewer-canvas" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        className="pattern-viewer-canvas-surface"
        aria-label={`${project.name} ${project.width} x ${project.height}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
      />
      <div className="pattern-viewer-board-chip">
        {project.width} × {project.height}
      </div>
      <div className="pattern-viewer-zoom-controls" aria-label="Viewer zoom controls">
        <button type="button" onClick={() => setZoom((current) => clamp(current * 0.9, 0.1, 4))} aria-label="Zoom out">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((current) => clamp(current * 1.1, 0.1, 4))} aria-label="Zoom in">+</button>
        <button type="button" onClick={fitToWindow}>{fitLabel}</button>
      </div>
    </div>
  );
}

function drawViewerPattern(
  context: CanvasRenderingContext2D,
  project: BeadProject,
  width: number,
  height: number,
  zoom: number,
  pan: { x: number; y: number },
  highlightedColorIds: Set<string>,
  flipHorizontal: boolean,
  flipVertical: boolean,
  visibleCells: VisibleCell[],
  settings: Props['settings'],
) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#ebe7df';
  context.fillRect(0, 0, width, height);

  const boardWidth = project.width * CELL_SIZE * zoom;
  const boardHeight = project.height * CELL_SIZE * zoom;
  const originX = (width - boardWidth) / 2 + pan.x;
  const originY = (height - boardHeight) / 2 + pan.y;
  const selected = highlightedColorIds;

  context.save();
  context.translate(originX, originY);
  const cellSize = CELL_SIZE * zoom;
  for (let destinationY = 0; destinationY < project.height; destinationY += 1) {
    for (let destinationX = 0; destinationX < project.width; destinationX += 1) {
      const sourceX = flipHorizontal ? project.width - 1 - destinationX : destinationX;
      const sourceY = flipVertical ? project.height - 1 - destinationY : destinationY;
      const left = destinationX * cellSize;
      const top = destinationY * cellSize;
      const visibleCell = visibleCells[sourceY * project.width + sourceX];
      const stack = visibleCell.stack;
      const topColorId = visibleCell.topColorId;
      const topColor = getColor(topColorId);
      if (topColor) {
        context.globalAlpha = selected.has(topColor.id) ? 1 : 0.2;
        context.fillStyle = topColor.hex;
        if (settings.beadDisplayMode === 'bead') {
          context.beginPath();
          context.arc(left + cellSize / 2, top + cellSize / 2, cellSize * 0.42, 0, Math.PI * 2);
          context.fill();
          if (isLightColor(topColor.rgb)) {
            context.globalAlpha = selected.has(topColor.id) ? 0.32 : 0.08;
            context.strokeStyle = '#111827';
            context.lineWidth = Math.max(1, cellSize * 0.055);
            context.stroke();
          }
        } else {
          context.fillRect(left, top, cellSize, cellSize);
        }
        if (settings.showLayerOverlap && stack.length > 1) {
          drawStackOverlay(context, stack, left, top, cellSize, selected);
        }
        context.globalAlpha = 1;
        if (settings.showColorCodes && cellSize >= 16) {
          context.globalAlpha = selected.has(topColor.id) ? 1 : 0.2;
          context.fillStyle = readableTextColor(topColor.rgb);
          context.font = `${Math.max(7, cellSize * 0.3)}px Arial`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(topColor.primaryCode, left + cellSize / 2, top + cellSize / 2);
          context.globalAlpha = 1;
        }
      }
      if (settings.showGrid) {
        context.strokeStyle = 'rgba(84, 79, 70, 0.18)';
        context.lineWidth = Math.max(0.5, Math.min(1, zoom));
        context.strokeRect(left, top, cellSize, cellSize);
      }
    }
  }

  if (project.settings.showPegboardBoundaries) {
    drawPegboardGuides(context, project, cellSize);
  }
  if (settings.showCoordinates && cellSize > 10) {
    drawCoordinates(context, project, cellSize);
  }
  context.restore();
}

function buildVisibleCells(project: BeadProject): VisibleCell[] {
  const visibleLayers = (project.layers ?? []).filter((layer) => layer.visible);
  return Array.from({ length: project.width * project.height }, (_, index) => {
    const stack: string[] = [];
    visibleLayers.forEach((layer) => {
      const colorId = layer.cells?.[index];
      if (colorId) stack.push(colorId);
    });
    return {
      stack,
      topColorId: stack[stack.length - 1] ?? null,
    };
  });
}

function getHoverCell(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement | null,
  project: BeadProject,
  zoom: number,
  pan: { x: number; y: number },
  flipHorizontal: boolean,
  flipVertical: boolean,
  visibleCells: VisibleCell[],
): { x: number; y: number; colorId: string | null } | null {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const boardWidth = project.width * CELL_SIZE * zoom;
  const boardHeight = project.height * CELL_SIZE * zoom;
  const originX = (rect.width - boardWidth) / 2 + pan.x;
  const originY = (rect.height - boardHeight) / 2 + pan.y;
  const destinationX = Math.floor((clientX - rect.left - originX) / (CELL_SIZE * zoom));
  const destinationY = Math.floor((clientY - rect.top - originY) / (CELL_SIZE * zoom));
  if (destinationX < 0 || destinationY < 0 || destinationX >= project.width || destinationY >= project.height) return null;
  const x = flipHorizontal ? project.width - 1 - destinationX : destinationX;
  const y = flipVertical ? project.height - 1 - destinationY : destinationY;
  return { x, y, colorId: visibleCells[y * project.width + x].topColorId };
}

function drawCoordinates(context: CanvasRenderingContext2D, project: BeadProject, cellSize: number) {
  context.fillStyle = 'rgba(17, 24, 39, 0.45)';
  context.font = '8px Arial';
  context.textAlign = 'left';
  context.textBaseline = 'top';
  for (let x = 0; x < project.width; x += 5) {
    context.fillText(String(x + 1), x * cellSize + 2, 2);
  }
  for (let y = 0; y < project.height; y += 5) {
    context.fillText(String(y + 1), 2, y * cellSize + 2);
  }
}

function drawStackOverlay(
  context: CanvasRenderingContext2D,
  stack: string[],
  left: number,
  top: number,
  cellSize: number,
  selected: Set<string>,
) {
  const topColorId = stack[stack.length - 1];
  const badgeRadius = Math.max(4, Math.min(6, cellSize * 0.25));
  context.save();
  context.globalAlpha = selected.has(topColorId) ? 0.9 : 0.24;
  context.fillStyle = 'rgba(17, 24, 39, 0.72)';
  context.beginPath();
  context.arc(left + badgeRadius + 1, top + badgeRadius + 1, badgeRadius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = `${Math.max(7, badgeRadius * 1.35)}px Arial`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(Math.min(stack.length, 9)), left + badgeRadius + 1, top + badgeRadius + 1);
  context.restore();
}

function drawPegboardGuides(context: CanvasRenderingContext2D, project: BeadProject, cellSize: number) {
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
    for (let offset = 1; offset < segmentLength; offset += 5) {
      centers.add((boardStart + offset) * cellSize);
    }
    if (segmentLength > 1) {
      centers.add((boardStart + segmentLength - 1) * cellSize);
    }
  }
  return [...centers].sort((a, b) => a - b);
}

function isLightColor(rgb: [number, number, number]): boolean {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 218;
}

function readableTextColor(rgb: [number, number, number]): string {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] < 130 ? '#ffffff' : '#111827';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
