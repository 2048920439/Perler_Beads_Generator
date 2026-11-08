import * as React from 'react';
import { useObservableState, useService } from '@/service-core';
import { CanvasEditService } from '@/services/canvas-edit-service';
import { ToolService } from '@/services/tool-service';
import { EditorQueryService } from '@/services/editor-query-service';
import { ImportService } from '@/services/import-service';
import { LocalizationService } from '@/services/localization-service';
import { PaletteService } from '@/services/palette-service';
import { ReferenceImageService, isEditableTarget } from '@/services/reference-image-service';
import { WorkspaceViewService } from '@/services/workspace-view-service';
import { drawPattern } from './Utils/canvas-renderer';
import type { ReferenceImageRenderOptions } from './Utils/board-renderer';
import type { PointerGridPoint, ShapeDraft } from './Utils/canvas-types';
import { almostSamePoint } from '@/services/domain/workspace/grid-geometry';

const { useCallback, useEffect, useMemo, useRef, useState } = React;

type HoverCell = {
  x: number;
  y: number;
  colorId: string | null;
};

export default function WorkspaceCanvas() {
  const localization = useService(LocalizationService);
  const palette = useService(PaletteService);
  const reference = useService(ReferenceImageService);
  const images = useService(ImportService);
  const view = useService(WorkspaceViewService);
  const editor = useService(EditorQueryService);
  useObservableState(localization.snapshot$);
  const { displayProject: project, highlightedCellIndices } = useObservableState(editor.snapshot$);
  const { selectedColorId } = useObservableState(palette.snapshot$);
  const { highlightedColorId } = useObservableState(view.snapshot$);
  const {
    url: referenceImageUrl, opacity: referenceImageOpacity, scale: referenceImageScale,
    offset: referenceImageOffset, placement: referenceImagePlacement, visible, adjusting,
  } = useObservableState(reference.snapshot$);
  const { isGenerating } = useObservableState(images.snapshot$);
  const referenceImageVisible = visible && !isGenerating;
  const referenceImageAdjusting = adjusting && referenceImageVisible;
  const toolService = useService(ToolService);
  const canvasEdit = useService(CanvasEditService);
  const canEdit = canvasEdit.canEdit;
  const toolState = useObservableState(toolService.snapshot$);
  const {
    tool, eraserSize, moveMode, removeMode, mirrorMode, shapeKind,
    textToolValue, textToolDirection, textToolSize, textToolSpacing, clipboardPattern, copyMode, copySelectionIndices,
  } = toolState;
  const onReferenceOffsetChange = (offset: { x: number; y: number }) => reference.update({ offset });
  const onHover = (cell: HoverCell | null) => view.setHoverCell(cell);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<PointerGridPoint | null>(null);
  const [shapeDraft, setShapeDraft] = useState<ShapeDraft | null>(null);
  const [referenceImage, setReferenceImage] = useState<HTMLImageElement | null>(null);
  const [activePointerMode, setActivePointerMode] = useState<'pan' | 'rightErase' | 'move' | 'shape' | 'reference' | null>(null);
  const pointerRef = useRef({
    pointerId: 0, lastX: 0, lastY: 0, panning: false, draggingReference: false,
    referenceOffsetX: 0, referenceOffsetY: 0,
  });

  const resetPointer = useCallback(() => {
    pointerRef.current.panning = false;
    pointerRef.current.draggingReference = false;
    setShapeDraft(null);
    setActivePointerMode(null);
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(pointerRef.current.pointerId)) canvas.releasePointerCapture(pointerRef.current.pointerId);
  }, []);

  const cancelGesture = useCallback(() => {
    canvasEdit.cancelGesture();
    resetPointer();
  }, [canvasEdit, resetPointer]);

  const cellSize = 18;
  const formatColorCode = React.useCallback((colorId: string) => palette.getColor(colorId)?.primaryCode ?? '', [palette]);
  const referenceImageOptions = useMemo<ReferenceImageRenderOptions>(
    () => ({
      image: referenceImage,
      visible: referenceImageVisible,
      opacity: referenceImageOpacity,
      scale: referenceImageScale,
      offset: referenceImageOffset,
      placement: referenceImagePlacement,
    }),
    [referenceImage, referenceImageVisible, referenceImageOpacity, referenceImageScale, referenceImageOffset, referenceImagePlacement],
  );

  const fitToWindow = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const availableWidth = wrapper.clientWidth - 88;
    const availableHeight = wrapper.clientHeight - 88;
    const patternWidth = project.width * cellSize;
    const patternHeight = project.height * cellSize;
    const nextZoom = Math.min(2.4, Math.max(0.12, Math.min(availableWidth / patternWidth, availableHeight / patternHeight)));
    setZoom(nextZoom);
    setPan({
      x: (wrapper.clientWidth - patternWidth * nextZoom) / 2,
      y: (wrapper.clientHeight - patternHeight * nextZoom) / 2,
    });
  }, [project.width, project.height, cellSize]);

  const constrainPan = useCallback((nextPan: { x: number; y: number }, nextZoom: number): { x: number; y: number } => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return nextPan;
    const boardWidth = project.width * cellSize * nextZoom;
    const boardHeight = project.height * cellSize * nextZoom;
    const clampAxis = (value: number, viewportSize: number, contentSize: number) => {
      const visibleGuard = Math.max(32, Math.min(120, viewportSize * 0.36, contentSize * 0.55));
      const min = visibleGuard - contentSize;
      const max = viewportSize - visibleGuard;
      if (min > max) return (viewportSize - contentSize) / 2;
      return Math.min(max, Math.max(min, value));
    };
    return {
      x: clampAxis(nextPan.x, wrapper.clientWidth, boardWidth),
      y: clampAxis(nextPan.y, wrapper.clientHeight, boardHeight),
    };
  }, [project.width, project.height, cellSize]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isEditableTarget(event.target)) {
        cancelGesture();
      }
      if (event.code === 'Space') setIsSpaceDown(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpaceDown(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [cancelGesture]);

  useEffect(() => () => canvasEdit.cancelGesture(), [canvasEdit]);

  useEffect(() => {
    if (!referenceImageUrl) {
      setReferenceImage(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setReferenceImage(image);
    };
    image.onerror = () => {
      if (!cancelled) setReferenceImage(null);
    };
    image.src = referenceImageUrl;
    return () => {
      cancelled = true;
    };
  }, [referenceImageUrl]);

  useEffect(() => {
    fitToWindow();
  }, [fitToWindow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(wrapper.clientWidth * dpr);
    canvas.height = Math.floor(wrapper.clientHeight * dpr);
    canvas.style.width = `${wrapper.clientWidth}px`;
    canvas.style.height = `${wrapper.clientHeight}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPattern(context, project, cellSize, zoom, pan, highlightedColorId, highlightedCellIndices, tool, selectedColorId, eraserSize, moveMode, removeMode, mirrorMode, clipboardPattern, copyMode, copySelectionIndices, shapeDraft, hoverPoint, canEdit, referenceImageOptions, textToolValue, textToolDirection, textToolSize, textToolSpacing, palette.getColor, formatColorCode);
  }, [project, cellSize, zoom, pan, highlightedColorId, highlightedCellIndices, tool, selectedColorId, eraserSize, moveMode, removeMode, mirrorMode, clipboardPattern, copyMode, copySelectionIndices, shapeKind, shapeDraft, hoverPoint, canEdit, referenceImageOptions, textToolValue, textToolDirection, textToolSize, textToolSpacing, formatColorCode, palette, canvasEdit]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(wrapper.clientWidth * dpr);
      canvas.height = Math.floor(wrapper.clientHeight * dpr);
      canvas.style.width = `${wrapper.clientWidth}px`;
      canvas.style.height = `${wrapper.clientHeight}px`;
      const context = canvas.getContext('2d');
      if (context) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawPattern(context, project, cellSize, zoom, pan, highlightedColorId, highlightedCellIndices, tool, selectedColorId, eraserSize, moveMode, removeMode, mirrorMode, clipboardPattern, copyMode, copySelectionIndices, shapeDraft, hoverPoint, canEdit, referenceImageOptions, textToolValue, textToolDirection, textToolSize, textToolSpacing, palette.getColor, formatColorCode);
      }
      setPan((current) => {
        const next = constrainPan(current, zoom);
        return almostSamePoint(current, next) ? current : next;
      });
    });
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [project, cellSize, zoom, pan, highlightedColorId, highlightedCellIndices, tool, selectedColorId, eraserSize, moveMode, removeMode, mirrorMode, clipboardPattern, copyMode, copySelectionIndices, shapeKind, shapeDraft, hoverPoint, canEdit, referenceImageOptions, textToolValue, textToolDirection, textToolSize, textToolSpacing, constrainPan, formatColorCode, palette]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = canvasToGridPoint(event.clientX, event.clientY);
    const action = canvasEdit.pointerAction(event.button, isSpaceDown);
    pointerRef.current.pointerId = event.pointerId;
    pointerRef.current.lastX = event.clientX;
    pointerRef.current.lastY = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (referenceImageAdjusting && referenceImageVisible && event.button === 0) {
      pointerRef.current.draggingReference = true;
      pointerRef.current.referenceOffsetX = referenceImageOffset.x;
      pointerRef.current.referenceOffsetY = referenceImageOffset.y;
      setActivePointerMode('reference');
      return;
    }
    if (action === 'pan') {
      pointerRef.current.panning = true;
      setActivePointerMode('pan');
      return;
    }
    if (!point?.cell) return;
    const mode = canvasEdit.startPointer({ ...point, cell: point.cell }, project, action === 'erase');
    if (mode === 'shape') setShapeDraft(canvasEdit.movePointer(point));
    if (mode === 'shape' || mode === 'move' || mode === 'rightErase') setActivePointerMode(mode);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current.draggingReference) {
      const dx = (event.clientX - pointerRef.current.lastX) / (cellSize * zoom);
      const dy = (event.clientY - pointerRef.current.lastY) / (cellSize * zoom);
      pointerRef.current.lastX = event.clientX;
      pointerRef.current.lastY = event.clientY;
      pointerRef.current.referenceOffsetX += dx;
      pointerRef.current.referenceOffsetY += dy;
      onReferenceOffsetChange({ x: pointerRef.current.referenceOffsetX, y: pointerRef.current.referenceOffsetY });
      return;
    }
    if (pointerRef.current.panning) {
      const dx = event.clientX - pointerRef.current.lastX;
      const dy = event.clientY - pointerRef.current.lastY;
      pointerRef.current.lastX = event.clientX;
      pointerRef.current.lastY = event.clientY;
      setPan((current) => constrainPan({ x: current.x + dx, y: current.y + dy }, zoom));
      return;
    }
    const point = canvasToGridPoint(event.clientX, event.clientY, canvasEdit.movingPointer);
    const cell = point?.cell ?? null;
    setHoverPoint(point);
    onHover(cell ? { ...cell, colorId: canvasEdit.getTopVisibleColor(project, cell.y * project.width + cell.x) } : null);
    if (point) {
      const shape = canvasEdit.movePointer(point);
      if (shape) setShapeDraft(shape);
    }
  }

  function handlePointerUp() {
    canvasEdit.finishPointer();
    resetPointer();
  }

  function handlePointerLeave() {
    setHoverPoint(null);
    onHover(null);
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    if (tool === 'text') {
      toolService.stepTextToolSize(event.deltaY > 0 ? -1 : 1);
      return;
    }
    if (referenceImageAdjusting && referenceImageVisible) {
      reference.stepScale(event.deltaY > 0 ? -1 : 1);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const before = screenToWorld(point.x, point.y);
    const nextZoom = Math.min(5, Math.max(0.12, zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
    setZoom(nextZoom);
    setPan(constrainPan({
      x: point.x - before.x * nextZoom,
      y: point.y - before.y * nextZoom,
    }, nextZoom));
  }

  function stepZoom(multiplier: number) {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const point = { x: wrapper.clientWidth / 2, y: wrapper.clientHeight / 2 };
    const before = screenToWorld(point.x, point.y);
    const nextZoom = Math.min(5, Math.max(0.12, zoom * multiplier));
    setZoom(nextZoom);
    setPan(constrainPan({
      x: point.x - before.x * nextZoom,
      y: point.y - before.y * nextZoom,
    }, nextZoom));
  }

  function canvasToGridPoint(clientX: number, clientY: number, allowOutside = false): PointerGridPoint | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const world = screenToWorld(clientX - rect.left, clientY - rect.top);
    const gridX = world.x / cellSize;
    const gridY = world.y / cellSize;
    const x = Math.floor(gridX);
    const y = Math.floor(gridY);
    const cell = x < 0 || y < 0 || x >= project.width || y >= project.height ? null : { x, y };
    if (!allowOutside && !cell && (gridX < -eraserSize || gridY < -eraserSize || gridX > project.width + eraserSize || gridY > project.height + eraserSize)) {
      return null;
    }
    return { cell, gridX, gridY };
  }

  function screenToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - pan.x) / zoom,
      y: (y - pan.y) / zoom,
    };
  }

  const canvasTool = activePointerMode === 'rightErase' ? 'eraser' : activePointerMode === 'pan' || activePointerMode === 'reference' || isSpaceDown ? 'pan' : activePointerMode === 'move' ? 'move' : activePointerMode === 'shape' ? 'shape' : tool;
  const canvasClassName = [
    'canvas',
    activePointerMode === 'pan' ? 'is-panning' : '',
    referenceImageAdjusting && referenceImageVisible ? 'is-reference-adjusting' : '',
    activePointerMode === 'move' ? 'is-moving' : '',
    isSpaceDown ? 'can-pan' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="workspace" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        className={canvasClassName}
        data-tool={canvasTool}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={cancelGesture}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
      />
      <div className="board-chip">
        {project.width} * {project.height}
      </div>
      {!canEdit && <div className="canvas-lock-hint">{localization.text.lockedCanvasHint}</div>}
      {referenceImageAdjusting && referenceImageVisible && (
        <div className="reference-adjust-hint">{localization.text.referenceAdjustHint}</div>
      )}
      <div className="zoom-controls" aria-label={localization.text.canvasZoomControls}>
        <button onClick={() => stepZoom(0.9)}>-</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => stepZoom(1.1)}>+</button>
        <button onClick={fitToWindow}>{localization.text.fit}</button>
      </div>
    </div>
  );
}
