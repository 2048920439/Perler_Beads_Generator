import * as React from 'react';
import type { ClipboardPattern } from '@/common/types';
import { useObservableState, useService } from '@/service-core';
import { CanvasEditService } from '@/services/canvas-edit-service';
import { ToolService } from '@/services/tool-service';
import { EditorService } from '@/services/editor-service';
import { ImageImportService } from '@/services/image-import-service';
import { LocalizationService } from '@/services/localization-service';
import { NoticeService } from '@/services/notice-service';
import { PaletteService } from '@/services/palette-service';
import { ProjectService } from '@/services/project-service';
import { ReferenceImageService } from '@/services/reference-image-service';
import { WorkspaceViewService } from '@/services/workspace-view-service';
import { drawPattern } from './Utils/canvas-renderer';
import type { ReferenceImageRenderOptions } from './Utils/board-renderer';
import type { PointerGridPoint, ShapeDraft } from './Utils/canvas-types';
import { almostSamePoint, linePoints } from './Utils/grid-geometry';
import { collectShapeIndices } from './Utils/shape-rasterizer';
import { collectTextIndices } from './Utils/text-rasterizer';

const { useCallback, useEffect, useMemo, useRef, useState } = React;

type HoverCell = {
  x: number;
  y: number;
  colorId: string | null;
};

export default function WorkspaceCanvas() {
  const projectService = useService(ProjectService);
  const localization = useService(LocalizationService);
  const notice = useService(NoticeService);
  const palette = useService(PaletteService);
  const reference = useService(ReferenceImageService);
  const images = useService(ImageImportService);
  const view = useService(WorkspaceViewService);
  const editor = useService(EditorService);
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
  const canEdit = !projectService.activeLayer.locked;
  const toolService = useService(ToolService);
  const canvasEdit = useService(CanvasEditService);
  const toolState = useObservableState(toolService.snapshot$);
  const {
    tool, eraserSize, moveMode, removeMode, mirrorMode, mirrorDirection, shapeKind, shapeFillMode, arrowKind,
    textToolValue, textToolDirection, textToolSize, textToolSpacing, clipboardPattern, copyMode, copySelectionIndices,
  } = toolState;
  const onReferenceOffsetChange = (offset: { x: number; y: number }) => reference.update({ offset });
  const onReferenceScaleChange = (scale: number) => reference.update({ scale });
  const onCommitStart = () => canvasEdit.beginGesture();
  const onCellsChange = (cells: Array<string | null>) => canvasEdit.updateCells(cells);
  const onReplaceColor = (sourceColorId: string) => {
    canvasEdit.replaceColor(sourceColorId, palette.snapshot.selectedColorId);
  };
  const onCopyPattern = (pattern: ClipboardPattern, switchToPaste = true) => toolService.copyPattern(pattern, switchToPaste);
  const onPickColor = (colorId: string) => {
    palette.selectColor(colorId);
    toolService.setTool('pencil');
    toolService.closeOptions();
    notice.show(localization.text.colorPicked);
  };
  const onHover = (cell: HoverCell | null) => view.setHoverCell(cell);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const draftCellsRef = useRef<Array<string | null>>(canvasEdit.activeLayerCells);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<PointerGridPoint | null>(null);
  const [shapeDraft, setShapeDraft] = useState<ShapeDraft | null>(null);
  const [referenceImage, setReferenceImage] = useState<HTMLImageElement | null>(null);
  const [activePointerMode, setActivePointerMode] = useState<'pan' | 'rightErase' | 'move' | 'shape' | 'reference' | null>(null);
  const pointerRef = useRef({
    drawing: false,
    panning: false,
    erasing: false,
    singleCellErasing: false,
    movingPattern: false,
    draggingReference: false,
    copySelecting: false,
    shaping: false,
    pointerId: 0,
    lastX: 0,
    lastY: 0,
    lastCellX: -1,
    lastCellY: -1,
    lastGridX: 0,
    lastGridY: 0,
    moveStartCellX: 0,
    moveStartCellY: 0,
    moveLastDx: 0,
    moveLastDy: 0,
    moveOriginCells: [] as Array<string | null>,
    moveSelectionIndices: [] as number[],
    referenceOffsetX: 0,
    referenceOffsetY: 0,
    copySelectionAction: 'add' as 'add' | 'remove',
    copySelectionSet: new Set<number>(),
    shapeStartCellX: 0,
    shapeStartCellY: 0,
    shapeLastCellX: 0,
    shapeLastCellY: 0,
  });

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
  }, []);

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
    draftCellsRef.current = canvasEdit.getActiveLayerCells(project);
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
    const cell = point?.cell ?? null;
    const rightClickAction = tool === 'pencil' ? project.settings.rightClickAction : 'pan';
    pointerRef.current.pointerId = event.pointerId;
    pointerRef.current.lastX = event.clientX;
    pointerRef.current.lastY = event.clientY;
    pointerRef.current.erasing = false;
    pointerRef.current.singleCellErasing = false;
    pointerRef.current.movingPattern = false;
    pointerRef.current.draggingReference = false;
    pointerRef.current.copySelecting = false;
    pointerRef.current.shaping = false;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (referenceImageAdjusting && referenceImageVisible && event.button === 0) {
      pointerRef.current.draggingReference = true;
      pointerRef.current.referenceOffsetX = referenceImageOffset.x;
      pointerRef.current.referenceOffsetY = referenceImageOffset.y;
      setActivePointerMode('reference');
      return;
    }

    if (tool === 'pan' || event.button === 1 || isSpaceDown || (event.button === 2 && rightClickAction === 'pan')) {
      pointerRef.current.panning = true;
      setActivePointerMode('pan');
      return;
    }

    if (!cell) return;
    if (event.button === 2 && rightClickAction === 'erase') {
      if (!canEdit) return;
      setActivePointerMode('rightErase');
      onCommitStart();
      draftCellsRef.current = canvasEdit.activeLayerCells.slice();
      pointerRef.current.drawing = true;
      pointerRef.current.erasing = true;
      pointerRef.current.singleCellErasing = true;
      pointerRef.current.lastCellX = cell.x;
      pointerRef.current.lastCellY = cell.y;
      pointerRef.current.lastGridX = point?.gridX ?? cell.x + 0.5;
      pointerRef.current.lastGridY = point?.gridY ?? cell.y + 0.5;
      applyTool(cell.x, cell.y, pointerRef.current.lastGridX, pointerRef.current.lastGridY);
      return;
    }

    if (tool === 'eyedropper') {
      const colorId = canvasEdit.getTopVisibleColor(project, cell.y * project.width + cell.x);
      if (colorId) onPickColor(colorId);
      return;
    }

    if (tool === 'copy') {
      const activeCells = canvasEdit.activeLayerCells;
      const startIndex = cell.y * project.width + cell.x;
      if (!activeCells[startIndex]) return;
      if (copyMode === 'selection') {
        const selected = new Set(copySelectionIndices);
        pointerRef.current.drawing = true;
        pointerRef.current.copySelecting = true;
        pointerRef.current.copySelectionAction = selected.has(startIndex) ? 'remove' : 'add';
        pointerRef.current.copySelectionSet = selected;
        pointerRef.current.lastCellX = cell.x;
        pointerRef.current.lastCellY = cell.y;
        applyCopySelection([{ x: cell.x, y: cell.y }]);
        return;
      }
      const indices = canvasEdit.collectConnectedOccupied(activeCells, cell.x, cell.y);
      const pattern = canvasEdit.createClipboardPattern(activeCells, indices);
      if (pattern.cells.some(Boolean)) onCopyPattern(pattern);
      return;
    }

    if (tool === 'recolor') {
      const sourceColorId = canvasEdit.getTopVisibleColor(project, cell.y * project.width + cell.x);
      if (!sourceColorId || sourceColorId === selectedColorId) return;
      onReplaceColor(sourceColorId);
      return;
    }

    if (!canEdit) return;

    if (tool === 'paste') {
      if (!clipboardPattern) return;
      onCommitStart();
      canvasEdit.paste(clipboardPattern, cell.x, cell.y);
      return;
    }

    if (tool === 'move') {
      const activeCells = canvasEdit.activeLayerCells;
      const startIndex = cell.y * project.width + cell.x;
      if (!activeCells[startIndex]) return;
      const selectionIndices =
        moveMode === 'partial'
          ? canvasEdit.collectConnectedOccupied(activeCells, cell.x, cell.y)
          : [];
      onCommitStart();
      draftCellsRef.current = activeCells.slice();
      pointerRef.current.drawing = true;
      pointerRef.current.movingPattern = true;
      pointerRef.current.lastGridX = point?.gridX ?? cell.x + 0.5;
      pointerRef.current.lastGridY = point?.gridY ?? cell.y + 0.5;
      pointerRef.current.moveStartCellX = Math.floor(point?.gridX ?? cell.x);
      pointerRef.current.moveStartCellY = Math.floor(point?.gridY ?? cell.y);
      pointerRef.current.moveLastDx = 0;
      pointerRef.current.moveLastDy = 0;
      pointerRef.current.moveOriginCells = activeCells.slice();
      pointerRef.current.moveSelectionIndices = selectionIndices;
      setActivePointerMode('move');
      return;
    }

    if (tool === 'mirror') {
      const activeCells = canvasEdit.activeLayerCells;
      const startIndex = cell.y * project.width + cell.x;
      if (!activeCells[startIndex]) return;
      const selectionIndices =
        mirrorMode === 'partial'
          ? canvasEdit.collectConnectedOccupied(activeCells, cell.x, cell.y)
          : [];
      const next = canvasEdit.mirror(mirrorDirection, selectionIndices, activeCells, false);
      if (next === activeCells) return;
      onCommitStart();
      onCellsChange(next);
      return;
    }

    if (tool === 'shape') {
      onCommitStart();
      draftCellsRef.current = canvasEdit.activeLayerCells.slice();
      pointerRef.current.drawing = true;
      pointerRef.current.shaping = true;
      pointerRef.current.shapeStartCellX = cell.x;
      pointerRef.current.shapeStartCellY = cell.y;
      pointerRef.current.shapeLastCellX = cell.x;
      pointerRef.current.shapeLastCellY = cell.y;
      setShapeDraft({
        kind: shapeKind,
        fillMode: shapeFillMode,
        arrowKind,
        start: { x: cell.x, y: cell.y },
        end: { x: cell.x, y: cell.y },
      });
      setActivePointerMode('shape');
      return;
    }

    if (tool === 'text') {
      const indices = collectTextIndices(textToolValue, textToolDirection, textToolSize, textToolSpacing, cell.x, cell.y, project.width, project.height);
      if (indices.length === 0) return;
      onCommitStart();
      canvasEdit.applyText(indices, selectedColorId);
      return;
    }

    onCommitStart();
    draftCellsRef.current = canvasEdit.activeLayerCells.slice();
    if (tool === 'fill') {
      canvasEdit.fill(cell.x, cell.y, selectedColorId);
      return;
    }

    if (tool === 'remove') {
      const activeCells = canvasEdit.activeLayerCells;
      const startIndex = cell.y * project.width + cell.x;
      if (!activeCells[startIndex]) return;
      canvasEdit.remove(cell.x, cell.y, removeMode, activeCells);
      return;
    }

    pointerRef.current.drawing = true;
    pointerRef.current.lastCellX = cell.x;
    pointerRef.current.lastCellY = cell.y;
    pointerRef.current.lastGridX = point?.gridX ?? cell.x + 0.5;
    pointerRef.current.lastGridY = point?.gridY ?? cell.y + 0.5;
    applyTool(cell.x, cell.y, pointerRef.current.lastGridX, pointerRef.current.lastGridY);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current.draggingReference) {
      const dx = (event.clientX - pointerRef.current.lastX) / (cellSize * zoom);
      const dy = (event.clientY - pointerRef.current.lastY) / (cellSize * zoom);
      pointerRef.current.lastX = event.clientX;
      pointerRef.current.lastY = event.clientY;
      pointerRef.current.referenceOffsetX += dx;
      pointerRef.current.referenceOffsetY += dy;
      onReferenceOffsetChange({
        x: pointerRef.current.referenceOffsetX,
        y: pointerRef.current.referenceOffsetY,
      });
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

    const point = canvasToGridPoint(event.clientX, event.clientY, pointerRef.current.movingPattern);
    const cell = point?.cell ?? null;
    setHoverPoint(point);
    onHover(cell ? { ...cell, colorId: canvasEdit.getTopVisibleColor(project, cell.y * project.width + cell.x) } : null);
    if (pointerRef.current.copySelecting) {
      if (cell) {
        applyCopySelection(linePoints(pointerRef.current.lastCellX, pointerRef.current.lastCellY, cell.x, cell.y));
        pointerRef.current.lastCellX = cell.x;
        pointerRef.current.lastCellY = cell.y;
      }
      return;
    }
    if (pointerRef.current.drawing && point) {
      if (pointerRef.current.shaping && cell) {
        if (cell.x !== pointerRef.current.shapeLastCellX || cell.y !== pointerRef.current.shapeLastCellY) {
          pointerRef.current.shapeLastCellX = cell.x;
          pointerRef.current.shapeLastCellY = cell.y;
          setShapeDraft({
            kind: shapeKind,
            fillMode: shapeFillMode,
            arrowKind,
            start: { x: pointerRef.current.shapeStartCellX, y: pointerRef.current.shapeStartCellY },
            end: { x: cell.x, y: cell.y },
          });
        }
        return;
      }
      if (pointerRef.current.movingPattern) {
        const proposedDx = Math.floor(point.gridX) - pointerRef.current.moveStartCellX;
        const proposedDy = Math.floor(point.gridY) - pointerRef.current.moveStartCellY;
        const originCells = pointerRef.current.moveOriginCells.length > 0 ? pointerRef.current.moveOriginCells : draftCellsRef.current;
        const { dx, dy } = canvasEdit.clampShift(originCells, proposedDx, proposedDy, pointerRef.current.moveSelectionIndices);
        if (
          pointerRef.current.moveSelectionIndices.length > 0 &&
          !canvasEdit.canShift(originCells, dx, dy, pointerRef.current.moveSelectionIndices)
        ) {
          return;
        }
        if (dx !== pointerRef.current.moveLastDx || dy !== pointerRef.current.moveLastDy) {
          pointerRef.current.moveLastDx = dx;
          pointerRef.current.moveLastDy = dy;
          canvasEdit.shift(dx, dy, pointerRef.current.moveSelectionIndices, originCells);
        }
        return;
      }
      if (tool === 'eraser' && !pointerRef.current.singleCellErasing) {
        drawBrushLine(pointerRef.current.lastGridX, pointerRef.current.lastGridY, point.gridX, point.gridY);
        pointerRef.current.lastGridX = point.gridX;
        pointerRef.current.lastGridY = point.gridY;
        if (cell) {
          pointerRef.current.lastCellX = cell.x;
          pointerRef.current.lastCellY = cell.y;
        }
        return;
      }
      if (cell) {
        drawLine(
          pointerRef.current.lastCellX,
          pointerRef.current.lastCellY,
          cell.x,
          cell.y,
          pointerRef.current.lastGridX,
          pointerRef.current.lastGridY,
          point.gridX,
          point.gridY,
        );
        pointerRef.current.lastCellX = cell.x;
        pointerRef.current.lastCellY = cell.y;
        pointerRef.current.lastGridX = point.gridX;
        pointerRef.current.lastGridY = point.gridY;
      }
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current.shaping) {
      const draft = shapeDraft ?? {
        kind: shapeKind,
        fillMode: shapeFillMode,
        arrowKind,
        start: { x: pointerRef.current.shapeStartCellX, y: pointerRef.current.shapeStartCellY },
        end: { x: pointerRef.current.shapeLastCellX, y: pointerRef.current.shapeLastCellY },
      };
      const indices = collectShapeIndices(draft.kind, draft.fillMode, draft.arrowKind, draft.start, draft.end, project.width, project.height);
      draftCellsRef.current = canvasEdit.applyShape(indices, selectedColorId, draftCellsRef.current);
    }
    pointerRef.current.drawing = false;
    pointerRef.current.panning = false;
    pointerRef.current.erasing = false;
    pointerRef.current.singleCellErasing = false;
    pointerRef.current.movingPattern = false;
    pointerRef.current.draggingReference = false;
    pointerRef.current.copySelecting = false;
    pointerRef.current.shaping = false;
    pointerRef.current.moveOriginCells = [];
    pointerRef.current.moveSelectionIndices = [];
    pointerRef.current.copySelectionSet = new Set<number>();
    setShapeDraft(null);
    setActivePointerMode(null);
    event.currentTarget.releasePointerCapture(pointerRef.current.pointerId);
  }

  function handlePointerLeave() {
    setHoverPoint(null);
    onHover(null);
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    if (tool === 'text') {
      const nextSize = Math.min(72, Math.max(5, textToolSize + (event.deltaY > 0 ? -1 : 1)));
      if (nextSize !== textToolSize) toolService.setTextToolSize(nextSize);
      return;
    }
    if (referenceImageAdjusting && referenceImageVisible) {
      const nextScale = Math.min(3, Math.max(0.25, referenceImageScale * (event.deltaY > 0 ? 0.94 : 1.06)));
      onReferenceScaleChange(nextScale);
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

  function applyTool(x: number, y: number, gridX = x + 0.5, gridY = y + 0.5) {
    const value = pointerRef.current.erasing || tool === 'eraser' ? null : selectedColorId;
    const next = canvasEdit.paintCell({
      x,
      y,
      gridX,
      gridY,
      value,
      brushSize: eraserSize,
      brush: value === null && !pointerRef.current.singleCellErasing,
    }, draftCellsRef.current);
    draftCellsRef.current = next;
  }

  function applyCopySelection(points: Array<{ x: number; y: number }>) {
    const { indices } = canvasEdit.updateCopySelection(
      points,
      pointerRef.current.copySelectionAction,
      [...pointerRef.current.copySelectionSet],
    );
    pointerRef.current.copySelectionSet = new Set(indices);
  }

  function drawLine(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    fromGridX = fromX + 0.5,
    fromGridY = fromY + 0.5,
    toGridX = toX + 0.5,
    toGridY = toY + 0.5,
  ) {
    const value = pointerRef.current.erasing || tool === 'eraser' ? null : selectedColorId;
    const next = canvasEdit.paintLine({
      from: { x: fromX, y: fromY, gridX: fromGridX, gridY: fromGridY },
      to: { x: toX, y: toY, gridX: toGridX, gridY: toGridY },
      value,
      brushSize: eraserSize,
      brush: value === null && !pointerRef.current.singleCellErasing,
    }, draftCellsRef.current);
    draftCellsRef.current = next;
  }

  function drawBrushLine(fromGridX: number, fromGridY: number, toGridX: number, toGridY: number) {
    const next = canvasEdit.paintBrushLine(
      { x: fromGridX, y: fromGridY },
      { x: toGridX, y: toGridY },
      eraserSize,
      draftCellsRef.current,
    );
    draftCellsRef.current = next;
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
        onPointerCancel={handlePointerUp}
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
