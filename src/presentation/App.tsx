import * as React from 'react';
import { ui, languageKey, type Language } from '@/config/localization';
import { tools, referenceShortcut, referenceLongPressDelay, sizePresets, defaultImportSettings, defaultColorId, defaultRecentColorIds, defaultAdjustments } from '@/config/editor';
import { adjustLayerCells, applyEffectToLayer, clampInteger, limitLayerColors, mergeCloseLayerColors, type AdjustmentSettings, type LayerEffect } from '@/modules/adjustments/colorOperations';
import { ArrowOptionIcon, CloseIcon, EyeIcon, ExportIcon, GitHubIcon, PlusIcon, RedoIcon, ResetIcon, ShapeOptionIcon, TrashIcon, ToolIcon, UndoIcon } from '@/common/ui/EditorIcons';
import WorkspaceCanvas from '@/presentation/canvas/WorkspaceCanvas';
import { SourcePanel } from '@/modules/image-import/SourcePanel';
import { LayerPanel } from '@/modules/layers/LayerPanel';
import { ClipboardPreview } from '@/modules/editor/ClipboardPreview';
import { AdjustmentPanel } from '@/modules/adjustments/AdjustmentPanel';
import { downloadPrintPdf, downloadPrintPng, downloadProjectJson, downloadUsageWorkbook } from '@/core/export/exporters';
import type { PrintExportOptions } from '@/core/export/exporters';
import { createAlignedReferenceBlob, imageFileToBeads } from '@/core/image-processing/imageToBeads';
import { ImageGridEditor, type GridCorners } from '@/presentation/canvas/ImageGridEditor';
import { basicPalette, completePalette, getColor } from '@/core/palette';
import { composeVisibleCells, createLayer, createProject, loadDraft, normalizeProject, parseProjectJson, saveDraft, withCells, withLayers } from '@/core/project';
import { findIsolatedBeads, summarizeUsage } from '@/core/usage';
import type { ArrowKind, BackgroundMode, BeadProject, ClipboardPattern, CopyMode, GenerationStyle, MirrorDirection, MoveMode, RemoveMode, RightClickAction, ShapeFillMode, ShapeKind, TextDirection, ToolId } from '@/common/types';

const { useEffect, useMemo, useRef, useState } = React;

type HoverCell = { x: number; y: number; colorId: string | null };
type DragTarget = { id: string; edge: 'before' | 'after' };
type PaletteMode = 'basic' | 'complete';
type FloatingHelp = { text: string; left: number; top: number };
type ReferencePlacement = 'below' | 'above';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const generationRequestRef = useRef(0);
  const adjustmentSessionRef = useRef<{ layerId: string | null; baseCells: Array<string | null> }>({ layerId: null, baseCells: [] });
  const soloVisibilitySnapshotRef = useRef<Record<string, boolean> | null>(null);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem(languageKey) === 'en' ? 'en' : 'zh'));
  const text = ui[language];
  const [project, setProject] = useState<BeadProject>(() => loadDraft() ?? createProject());
  const [selectedColorId, setSelectedColorId] = useState(defaultColorId);
  const [recentColorIds, setRecentColorIds] = useState(defaultRecentColorIds);
  const [tool, setTool] = useState<ToolId>('pencil');
  const [eraserSize, setEraserSize] = useState(0);
  const [removeMode, setRemoveMode] = useState<RemoveMode>('same-connected');
  const [moveMode, setMoveMode] = useState<MoveMode>('layer');
  const [mirrorMode, setMirrorMode] = useState<MoveMode>('layer');
  const [mirrorDirection, setMirrorDirection] = useState<MirrorDirection>('horizontal');
  const [shapeKind, setShapeKind] = useState<ShapeKind>('line');
  const [shapeFillMode, setShapeFillMode] = useState<ShapeFillMode>('outline');
  const [arrowKind, setArrowKind] = useState<ArrowKind>('single');
  const [textToolValue, setTextToolValue] = useState('ABC');
  const [textToolDirection, setTextToolDirection] = useState<TextDirection>('horizontal');
  const [textToolSize, setTextToolSize] = useState(17);
  const [textToolSpacing, setTextToolSpacing] = useState(1);
  const [showPrintExportPanel, setShowPrintExportPanel] = useState(false);
  const [printExportOptions, setPrintExportOptions] = useState<PrintExportOptions>({
    format: 'png',
    exportBounds: 'pattern',
    showColorCodes: true,
    showGuideLines: true,
    projectName: '',
    authorName: '',
  });
  const [showPencilOptions, setShowPencilOptions] = useState(false);
  const [showEraserOptions, setShowEraserOptions] = useState(false);
  const [showRemoveOptions, setShowRemoveOptions] = useState(false);
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  const [showMirrorOptions, setShowMirrorOptions] = useState(false);
  const [showShapeOptions, setShowShapeOptions] = useState(false);
  const [showTextOptions, setShowTextOptions] = useState(false);
  const [showClipboardOptions, setShowClipboardOptions] = useState(false);
  const [showPanOptions, setShowPanOptions] = useState(false);
  const [clipboardPattern, setClipboardPattern] = useState<ClipboardPattern | null>(null);
  const [copyMode, setCopyMode] = useState<CopyMode>('connected');
  const [copySelectionIndices, setCopySelectionIndices] = useState<number[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showImageGridEditor, setShowImageGridEditor] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [referenceVisible, setReferenceVisible] = useState(false);
  const [referenceOpacity, setReferenceOpacity] = useState(0.35);
  const [referenceScale, setReferenceScale] = useState(1);
  const [referenceOffset, setReferenceOffset] = useState({ x: 0, y: 0 });
  const [referenceAdjusting, setReferenceAdjusting] = useState(false);
  const [referencePlacement, setReferencePlacement] = useState<ReferencePlacement>('below');
  const referenceVisibleRef = useRef(referenceVisible);
  const referenceShortcutRef = useRef<{
    pressed: boolean;
    pressedAt: number;
    visibleBeforePress: boolean;
  }>({
    pressed: false,
    pressedAt: 0,
    visibleBeforePress: false,
  });
  const [canvasWidth, setCanvasWidth] = useState(project.width);
  const [canvasHeight, setCanvasHeight] = useState(project.height);
  const [convertWidth, setConvertWidth] = useState(defaultImportSettings.width);
  const [maxColors, setMaxColors] = useState(defaultImportSettings.maxColors);
  const [generationStyle, setGenerationStyle] = useState<GenerationStyle>(defaultImportSettings.generationStyle);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(defaultImportSettings.backgroundMode);
  const [tolerance, setTolerance] = useState(defaultImportSettings.tolerance);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState(text.workspaceReady);
  const [floatingHelp, setFloatingHelp] = useState<FloatingHelp | null>(null);
  const [hoverCell, setHoverCell] = useState<HoverCell | null>(null);
  const [highlightedColorId, setHighlightedColorId] = useState<string | null>(null);
  const [showIsolatedBeads, setShowIsolatedBeads] = useState(false);
  const [rightTab, setRightTab] = useState<'palette' | 'layers' | 'usage' | 'adjustments'>('palette');
  const [paletteMode, setPaletteMode] = useState<PaletteMode>('basic');
  const [paletteGroup, setPaletteGroup] = useState('all');
  const [adjustments, setAdjustments] = useState<AdjustmentSettings>(defaultAdjustments);
  const [colorCleanupStrength, setColorCleanupStrength] = useState(2);
  const [layerColorLimit, setLayerColorLimit] = useState(16);
  const [past, setPast] = useState<BeadProject[]>([]);
  const [future, setFuture] = useState<BeadProject[]>([]);
  const usage = useMemo(() => summarizeUsage(project), [project]);
  const totalBeads = usage.reduce((sum, row) => sum + row.count, 0);
  const totalPacks = usage.reduce((sum, row) => sum + row.packs, 0);
  const boardCount =
    Math.ceil(project.width / project.boardSettings.boardWidth) *
    Math.ceil(project.height / project.boardSettings.boardHeight);
  const isolatedBeadRefs = useMemo(() => findIsolatedBeads(project), [project]);
  const isolatedBeads = isolatedBeadRefs.length;
  const isolatedCellIndices = useMemo(
    () => (showIsolatedBeads ? [...new Set(isolatedBeadRefs.map((item) => item.index))] : []),
    [isolatedBeadRefs, showIsolatedBeads],
  );
  const selectedColor = getColor(selectedColorId);
  const activePalette = paletteMode === 'basic' ? basicPalette : completePalette;
  const recentColors = recentColorIds.flatMap((id) => {
    const color = activePalette.find((item) => item.id === id);
    return color ? [color] : [];
  });
  const paletteGroups = useMemo(
    () => [
      { id: 'all', label: 'All' },
      ...[...new Set(activePalette.map((color) => color.group))].map((group) => ({ id: group, label: group })),
    ],
    [activePalette],
  );
  const visiblePalette = useMemo(
    () => (paletteGroup === 'all' ? activePalette : activePalette.filter((color) => color.group === paletteGroup)),
    [activePalette, paletteGroup],
  );

  function displayCode(color: NonNullable<typeof selectedColor>): string {
    return color.primaryCode;
  }

  function displayName(color: NonNullable<typeof selectedColor>): string {
    return color.name;
  }

  function showFloatingHelp(anchor: HTMLElement, tooltip: string) {
    const rect = anchor.getBoundingClientRect();
    const tooltipWidth = 172;
    const left = Math.min(rect.right + 8, window.innerWidth - tooltipWidth - 10);
    setFloatingHelp({
      text: tooltip,
      left,
      top: rect.top + rect.height / 2,
    });
  }

  function imageHelpProps(tooltip: string) {
    return {
      'data-tooltip': tooltip,
      'aria-label': tooltip,
      tabIndex: 0,
      onMouseEnter: (event: React.MouseEvent<HTMLElement>) => showFloatingHelp(event.currentTarget, tooltip),
      onMouseLeave: () => setFloatingHelp(null),
      onFocus: (event: React.FocusEvent<HTMLElement>) => showFloatingHelp(event.currentTarget, tooltip),
      onBlur: () => setFloatingHelp(null),
    };
  }

  function displayCodeById(colorId: string): string {
    const color = getColor(colorId);
    return color ? displayCode(color) : '';
  }

  function layerDisplayName(layer: BeadProject['layers'][number], index: number): string {
    if (layer.customName) return layer.name;
    const match = layer.name.match(/^(?:Layer|图层)\s+(\d+)$/);
    if (match) return language === 'zh' ? `图层 ${match[1]}` : `Layer ${match[1]}`;
    if (layer.id === 'base' || layer.name === 'Pattern' || layer.name === 'Base bead layer' || layer.name === '基础珠子层') {
      return systemLayerName(index);
    }
    if (!layer.name.trim()) return language === 'zh' ? `图层 ${index + 1}` : `Layer ${index + 1}`;
    return layer.name;
  }

  function systemLayerName(index: number): string {
    return language === 'zh' ? `图层 ${index + 1}` : `Layer ${index + 1}`;
  }

  function saveLayerName(layer: BeadProject['layers'][number], index: number, name: string) {
    const nextName = name.trim();
    if (!nextName) return;
    const isSystemName = nextName === `图层 ${index + 1}` || nextName === `Layer ${index + 1}`;
    if (isSystemName && !layer.customName) return;
    if (nextName === layer.name && layer.customName) return;
    updateLayer(layer.id, { name: nextName, customName: !isSystemName });
  }

  function layerMetaText(isActive: boolean, isVisible: boolean, isLocked: boolean, beadCount: number): string {
    const countText = text.layerBeadCount(beadCount);
    const states = [];
    if (isActive) states.push(text.activeLayer);
    if (!isVisible) states.push(text.hiddenLayer);
    if (isLocked) states.push(text.lockedLayer);
    states.push(countText);
    return states.join(' - ');
  }

  useEffect(() => {
    saveDraft(project);
  }, [project]);

  useEffect(() => {
    localStorage.setItem(languageKey, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    referenceVisibleRef.current = referenceVisible;
  }, [referenceVisible]);

  useEffect(() => {
    const shortcutState = referenceShortcutRef.current;

    function resetShortcutState() {
      if (shortcutState.pressed) {
        setReferenceVisible(false);
      }
      shortcutState.pressed = false;
      shortcutState.pressedAt = 0;
    }

    function isEditableTarget(target: EventTarget | null) {
      return target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'));
    }

    function onKeyDown(event: KeyboardEvent) {
      if (
        event.code !== referenceShortcut ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.isComposing ||
        isEditableTarget(event.target) ||
        !referenceImageUrl ||
        shortcutState.pressed
      ) {
        return;
      }

      event.preventDefault();
      shortcutState.pressed = true;
      shortcutState.pressedAt = performance.now();
      shortcutState.visibleBeforePress = referenceVisibleRef.current;
      setReferenceVisible(true);
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== referenceShortcut || !shortcutState.pressed) return;

      event.preventDefault();
      const pressDuration = performance.now() - shortcutState.pressedAt;
      if (pressDuration >= referenceLongPressDelay) {
        setReferenceVisible(false);
      } else {
        setReferenceVisible(!shortcutState.visibleBeforePress);
      }
      shortcutState.pressed = false;
      shortcutState.pressedAt = 0;
    }

    function onWindowBlur() {
      resetShortcutState();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      resetShortcutState();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [referenceImageUrl]);

  useEffect(() => {
    if (!showPrintExportPanel) return;
    function onPrintExportKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowPrintExportPanel(false);
    }
    function onPrintExportPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('.print-export-menu')) return;
      setShowPrintExportPanel(false);
    }
    window.addEventListener('keydown', onPrintExportKeyDown);
    window.addEventListener('pointerdown', onPrintExportPointerDown);
    return () => {
      window.removeEventListener('keydown', onPrintExportKeyDown);
      window.removeEventListener('pointerdown', onPrintExportPointerDown);
    };
  }, [showPrintExportPanel]);

  useEffect(() => {
    return () => {
      if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    };
  }, [pendingImageUrl]);

  useEffect(() => {
    return () => {
      if (referenceImageUrl) URL.revokeObjectURL(referenceImageUrl);
    };
  }, [referenceImageUrl]);

  useEffect(() => {
    setCanvasWidth(project.width);
    setCanvasHeight(project.height);
  }, [project.width, project.height]);

  useEffect(() => {
    setNotice((current: string) => {
      if (current === ui.zh.workspaceReady || current === ui.en.workspaceReady) return text.workspaceReady;
      const zhGenerated = current.match(/^(\d+) 色 - (\d+) 颗 - 可编辑图案已生成。$/);
      if (zhGenerated) return `${zhGenerated[1]} colors - ${zhGenerated[2]} beads - editable pattern ready.`;
      const enGenerated = current.match(/^(\d+) colors - (\d+) beads - editable pattern ready\.$/);
      if (enGenerated) return `${enGenerated[1]} 色 - ${enGenerated[2]} 颗 - 可编辑图案已生成。`;
      return current;
    });
  }, [language, text.workspaceReady]);

  useEffect(() => {
    if (!activePalette.some((color) => color.id === selectedColorId)) {
      setSelectedColorId(activePalette[0].id);
    }
    if (!paletteGroups.some((group) => group.id === paletteGroup)) {
      setPaletteGroup('all');
    }
  }, [activePalette, paletteGroups, paletteGroup, selectedColorId]);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'));
      if (file) handleImageFile(file);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  function commitHistory() {
    setPast((items) => [...items.slice(-39), project]);
    setFuture([]);
  }

  function updateProject(next: BeadProject) {
    setProject({ ...next, updatedAt: new Date().toISOString() });
  }

  function selectColor(colorId: string, options: { updateRecent?: boolean } = {}) {
    setSelectedColorId(colorId);
    if (options.updateRecent === false) return;
    setRecentColorIds((current) => [colorId, ...current.filter((id) => id !== colorId)].slice(0, 7));
  }

  function activateTool(nextTool: ToolId) {
    const closingTextOptions = nextTool === 'text' && tool === 'text' && showTextOptions;
    setTool(nextTool);
    setShowPencilOptions(nextTool === 'pencil');
    setShowEraserOptions(nextTool === 'eraser');
    setShowRemoveOptions(nextTool === 'remove');
    setShowMoveOptions(nextTool === 'move');
    setShowMirrorOptions(nextTool === 'mirror');
    setShowShapeOptions(nextTool === 'shape');
    setShowTextOptions(nextTool === 'text' && !closingTextOptions);
    setShowClipboardOptions(nextTool === 'copy' || nextTool === 'paste');
    setShowPanOptions(nextTool === 'pan');
  }

  useEffect(() => {
    function onToolKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'))) return;

      const nextTool = tools.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase());
      if (!nextTool) return;
      event.preventDefault();
      if (nextTool.id !== tool) activateTool(nextTool.id);
    }
    window.addEventListener('keydown', onToolKeyDown);
    return () => window.removeEventListener('keydown', onToolKeyDown);
  }, [tool, showTextOptions]);

  function updateCells(cells: Array<string | null>) {
    updateProject(withCells(project, cells));
  }

  function resetImportSettings() {
    setConvertWidth(defaultImportSettings.width);
    setMaxColors(defaultImportSettings.maxColors);
    setGenerationStyle(defaultImportSettings.generationStyle);
    setBackgroundMode(defaultImportSettings.backgroundMode);
    setTolerance(defaultImportSettings.tolerance);
  }

  function resetReferenceTransform() {
    setReferenceScale(1);
    setReferenceOffset({ x: 0, y: 0 });
    setReferenceAdjusting(false);
  }

  function resetAdjustments() {
    const session = adjustmentSessionRef.current;
    if (session.layerId === activeLayer.id && session.baseCells.length === activeLayer.cells.length) {
      updateProject(withLayers(project, layers.map((layer) => (layer.id === activeLayer.id ? { ...layer, cells: session.baseCells.slice() } : layer))));
    }
    setAdjustments(defaultAdjustments);
    adjustmentSessionRef.current = { layerId: null, baseCells: [] };
  }

  function updateAdjustment(key: keyof AdjustmentSettings, value: number) {
    if (activeLayer.locked) {
      setNotice(text.adjustmentLocked);
      return;
    }
    const nextAdjustments = { ...adjustments, [key]: value };
    if (adjustmentSessionRef.current.layerId !== activeLayer.id) {
      adjustmentSessionRef.current = { layerId: activeLayer.id, baseCells: activeLayer.cells.slice() };
      commitHistory();
    }
    const baseCells = adjustmentSessionRef.current.baseCells.length > 0 ? adjustmentSessionRef.current.baseCells : activeLayer.cells;
    const adjustedCells = adjustLayerCells(baseCells, nextAdjustments, activePalette);
    setAdjustments(nextAdjustments);
    updateProject(withLayers(project, layers.map((layer) => (layer.id === activeLayer.id ? { ...layer, cells: adjustedCells } : layer))));
  }

  function applyColorCleanup() {
    if (activeLayer.locked) {
      setNotice(text.adjustmentLocked);
      return;
    }
    const { cells, changed } = mergeCloseLayerColors(activeLayer.cells, activePalette, colorCleanupStrength);
    if (changed > 0) {
      commitHistory();
      updateProject(withLayers(project, layers.map((layer) => (layer.id === activeLayer.id ? { ...layer, cells } : layer))));
    }
    setNotice(text.layerColorsCleaned(changed));
  }

  function applyLayerColorLimit() {
    if (activeLayer.locked) {
      setNotice(text.adjustmentLocked);
      return;
    }
    const { cells, changed } = limitLayerColors(activeLayer.cells, activePalette, layerColorLimit);
    if (changed > 0) {
      commitHistory();
      updateProject(withLayers(project, layers.map((layer) => (layer.id === activeLayer.id ? { ...layer, cells } : layer))));
    }
    setNotice(text.layerColorsLimited(changed, layerColorLimit));
  }

  function applyLayerEffect(effect: LayerEffect, label: string) {
    if (activeLayer.locked) {
      setNotice(text.adjustmentLocked);
      return;
    }
    const { cells, changed } = applyEffectToLayer(activeLayer.cells, activePalette, effect);
    if (changed > 0) {
      commitHistory();
      updateProject(withLayers(project, layers.map((layer) => (layer.id === activeLayer.id ? { ...layer, cells } : layer))));
    }
    setNotice(text.effectApplied(label, changed));
  }

  function replaceColor(sourceColorId: string) {
    if (!sourceColorId || sourceColorId === selectedColorId) return;
    let changed = 0;
    const visibleLayerIds = new Set(displayProject.layers.filter((layer) => layer.visible).map((layer) => layer.id));
    const nextLayers = layers.map((layer) => {
      if (layer.locked || !visibleLayerIds.has(layer.id)) return layer;
      let layerChanged = false;
      const cells = layer.cells.map((cell) => {
        if (cell !== sourceColorId) return cell;
        changed += 1;
        layerChanged = true;
        return selectedColorId;
      });
      return layerChanged ? { ...layer, cells } : layer;
    });
    if (changed === 0) return;
    commitHistory();
    updateProject(withLayers(project, nextLayers, project.activeLayerId));
    setNotice(text.recoloredBeads(changed));
  }

  function undo() {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [...items, project]);
    updateProject(previous);
  }

  function redo() {
    const next = future[future.length - 1];
    if (!next) return;
    setFuture((items) => items.slice(0, -1));
    setPast((items) => [...items, project]);
    updateProject(next);
  }

  useEffect(() => {
    function onHistoryKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'))) return;

      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onHistoryKeyDown);
    return () => window.removeEventListener('keydown', onHistoryKeyDown);
  }, [project, past, future]);

  function startBlank(width = 52, height = 52) {
    soloVisibilitySnapshotRef.current = null;
    commitHistory();
    setProject(createProject(width, height));
    setClipboardPattern(null);
    setCopySelectionIndices([]);
    resetAdjustments();
    resetImportSettings();
    setSelectedColorId(defaultColorId);
    setRecentColorIds(defaultRecentColorIds);
    setPaletteGroup('all');
    setPendingFile(null);
    setPendingImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setReferenceFile(null);
    setReferenceImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setReferenceVisible(false);
    resetReferenceTransform();
    setNotice(language === 'zh' ? `已创建 ${width} * ${height} 空白画布。` : `Blank ${width} x ${height} canvas created.`);
  }

  function clearCanvas() {
    if (activeLayer.locked) return;
    if (activeLayer.cells.every((cell) => cell === null)) return;
    commitHistory();
    updateProject(withCells(project, Array.from({ length: project.width * project.height }, () => null)));
    setNotice(language === 'zh' ? '画布已清空。' : 'Canvas cleared.');
  }

  function resizeCanvas() {
    const width = clampInteger(canvasWidth, 8, 180);
    const height = clampInteger(canvasHeight, 8, 180);
    if (width === project.width && height === project.height) return;

    commitHistory();
    const nextLayers = layers.map((layer) => ({
      ...layer,
      cells: resizeCells(layer.cells, project.width, project.height, width, height),
    }));
    updateProject({
      ...project,
      width,
      height,
      layers: nextLayers,
      cells: composeVisibleCells(nextLayers, width, height),
    });
    setNotice(language === 'zh' ? `画布已调整为 ${width} * ${height}。` : `Canvas resized to ${width} x ${height}.`);
  }

  function applyPreset(value: string) {
    const preset = sizePresets.find((item) => item.label === value);
    if (!preset) return;
    setCanvasWidth(preset.width);
    setCanvasHeight(preset.height);
  }

  function handleImageFile(file: File) {
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
      setNotice(language === 'zh' ? '请使用 PNG、JPG、JPEG 或 WebP 图片。' : 'Use a PNG, JPG, JPEG, or WebP image.');
      return;
    }
    setPendingFile(file);
    setPendingImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setShowImageGridEditor(true);
    setNotice(language === 'zh' ? `正在生成 ${file.name}...` : `Generating ${file.name}...`);
  }

  function handleReferenceImageFile(file: File) {
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
      setNotice(language === 'zh' ? '请使用 PNG、JPG、JPEG 或 WebP 图片。' : 'Use a PNG, JPG, JPEG, or WebP image.');
      return;
    }
    setReferenceFile(file);
    setReferenceImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    resetReferenceTransform();
    setReferenceVisible(true);
    setNotice(language === 'zh' ? `${file.name} 已设为参考图。` : `${file.name} set as reference image.`);
  }

  async function generateFromImage(width: number, height: number, corners: GridCorners) {
    if (!pendingFile) return;
    if (activeLayer.locked) {
      setNotice(text.lockedCanvasHint);
      return;
    }
    const requestId = generationRequestRef.current + 1;
    generationRequestRef.current = requestId;
    const sourceFile = pendingFile;
    const targetLayerId = activeLayer.id;
    const sourceProject = project;
    const sourceLayers = layers;
    setIsGenerating(true);
    setNotice(language === 'zh' ? '正在本地更新拼豆图案...' : 'Updating bead pattern locally...');
    try {
      const result = await imageFileToBeads(sourceFile, {
        width,
        height,
        gridCorners: corners,
        maxColors,
        palette: activePalette,
        generationStyle,
        backgroundMode,
        backgroundColor: [255, 255, 255],
        tolerance,
        speckleReduction: defaultImportSettings.speckleReduction,
      });
      if (requestId !== generationRequestRef.current) return;
      const nextWidth = Math.max(sourceProject.width, result.width);
      const nextHeight = Math.max(sourceProject.height, result.height);
      const referenceBlob = await createAlignedReferenceBlob(
        sourceFile,
        result.width,
        result.height,
        nextWidth,
        nextHeight,
        corners,
      );
      if (requestId !== generationRequestRef.current) return;
      commitHistory();
      const nextLayers = sourceLayers.map((layer) => {
        if (layer.id === targetLayerId) {
          return {
            ...layer,
            cells: resizeCells(result.cells, result.width, result.height, nextWidth, nextHeight),
          };
        }
        return {
          ...layer,
          cells: resizeCells(layer.cells, sourceProject.width, sourceProject.height, nextWidth, nextHeight),
        };
      });
      const nextProject = {
        ...sourceProject,
        width: nextWidth,
        height: nextHeight,
        activeLayerId: targetLayerId,
        layers: nextLayers,
        cells: composeVisibleCells(nextLayers, nextWidth, nextHeight),
      };
      updateProject(nextProject);
      setReferenceFile(sourceFile);
      setReferenceImageUrl(URL.createObjectURL(referenceBlob));
      setReferenceVisible(true);
      resetReferenceTransform();
      setNotice(
        language === 'zh'
          ? `${result.colorsUsed} 色 - ${result.totalBeads} 颗 - 可编辑图案已生成。`
          : `${result.colorsUsed} colors - ${result.totalBeads} beads - editable pattern ready.`,
      );
    } catch (error) {
      if (requestId !== generationRequestRef.current) return;
      setNotice(error instanceof Error ? error.message : 'Could not generate this image.');
    } finally {
      if (requestId === generationRequestRef.current) setIsGenerating(false);
    }
  }

  async function importJson(file: File) {
    let imported: BeadProject;
    let raw: string;
    try {
      raw = await file.text();
    } catch {
      throw new Error(text.unreadableRecord);
    }
    try {
      imported = parseProjectJson(raw);
    } catch {
      throw new Error(text.invalidRecord);
    }
    soloVisibilitySnapshotRef.current = null;
    commitHistory();
    setProject(normalizeProject(imported));
    setPendingFile(null);
    setPendingImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setNotice(text.recordImported);
  }

  function exportUsageList() {
    downloadUsageWorkbook(project);
    setNotice(text.usageExported);
  }

  function exportEditRecord() {
    downloadProjectJson(project);
    setNotice(text.recordExported);
  }

  function resetClipboard() {
    setClipboardPattern(null);
    setCopySelectionIndices([]);
    setNotice(text.clipboardReset);
  }

  function addLayer() {
    commitHistory();
    const nextLayer = createLayer(project.width, project.height, `${text.layers} ${layers.length + 1}`);
    updateProject(withLayers(project, [...layers, nextLayer], nextLayer.id));
  }

  function duplicateLayer(layerId: string) {
    const sourceIndex = layers.findIndex((layer) => layer.id === layerId);
    const source = layers[sourceIndex];
    if (!source) return;
    commitHistory();
    const displayName = layerDisplayName(source, sourceIndex);
    const nextLayer = {
      ...source,
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: uniqueDuplicateLayerName(displayName),
      customName: true,
      locked: false,
      cells: source.cells.slice(),
    };
    const nextLayers = layers.slice();
    nextLayers.splice(sourceIndex + 1, 0, nextLayer);
    updateProject(withLayers(project, nextLayers, nextLayer.id));
  }

  function uniqueDuplicateLayerName(baseName: string): string {
    const suffix = language === 'zh' ? '复制' : 'copy ';
    const existingNames = new Set(layers.map((layer, index) => layerDisplayName(layer, index)));
    for (let index = 1; index < 1000; index += 1) {
      const candidate = language === 'zh' ? `${baseName}-${suffix}${index}` : `${baseName}-${suffix}${index}`;
      if (!existingNames.has(candidate)) return candidate;
    }
    return language === 'zh' ? `${baseName}-${suffix}${Date.now()}` : `${baseName}-${suffix}${Date.now()}`;
  }

  function updateLayer(layerId: string, changes: Partial<BeadProject['layers'][number]>) {
    commitHistory();
    updateProject(withLayers(project, layers.map((layer) => (layer.id === layerId ? { ...layer, ...changes } : layer))));
  }

  function updateUsageLayerSelection(includedLayerIds: Set<string>) {
    const nextLayers = layers.map((layer) => ({
      ...layer,
      includeInUsage: includedLayerIds.has(layer.id),
    }));
    const changed = nextLayers.some((layer, index) => layer.includeInUsage !== layers[index].includeInUsage);
    if (!changed) return;
    commitHistory();
    updateProject(withLayers(project, nextLayers, project.activeLayerId));
  }

  function toggleUsageLayer(layerId: string) {
    const includedLayerIds = new Set(countedLayers.map((layer) => layer.id));
    if (includedLayerIds.has(layerId)) {
      includedLayerIds.delete(layerId);
    } else {
      includedLayerIds.add(layerId);
    }
    updateUsageLayerSelection(includedLayerIds);
  }

  function toggleActiveLayerOnly() {
    const shouldEnable = !project.settings.showActiveLayerOnly;
    if (shouldEnable) {
      soloVisibilitySnapshotRef.current = Object.fromEntries(layers.map((layer) => [layer.id, layer.visible]));
      const soloLayers = layers.map((layer) => ({
        ...layer,
        visible: layer.id === activeLayer.id,
      }));
      updateProject({
        ...project,
        settings: { ...project.settings, showActiveLayerOnly: true },
        layers: soloLayers,
        cells: composeVisibleCells(soloLayers, project.width, project.height),
      });
      return;
    }

    const snapshot = soloVisibilitySnapshotRef.current;
    soloVisibilitySnapshotRef.current = null;
    const restoredLayers = layers.map((layer) => ({
      ...layer,
      visible: snapshot?.[layer.id] ?? layer.visible,
    }));
    updateProject({
      ...project,
      settings: { ...project.settings, showActiveLayerOnly: false },
      layers: restoredLayers,
      cells: composeVisibleCells(restoredLayers, project.width, project.height),
    });
  }

  function deleteLayer(layerId: string) {
    if (layers.length <= 1) return;
    commitHistory();
    updateProject(withLayers(project, layers.filter((layer) => layer.id !== layerId)));
  }

  function moveLayer(sourceId: string, target: DragTarget) {
    if (sourceId === target.id) return;
    const originalDisplayLayers = [...layers].reverse();
    const nextDisplayLayers = originalDisplayLayers.slice();
    const sourceIndex = nextDisplayLayers.findIndex((layer) => layer.id === sourceId);
    if (sourceIndex < 0) return;
    const [movedLayer] = nextDisplayLayers.splice(sourceIndex, 1);
    const targetIndex = nextDisplayLayers.findIndex((layer) => layer.id === target.id);
    if (targetIndex < 0) return;
    const insertIndex = target.edge === 'after' ? targetIndex + 1 : targetIndex;
    nextDisplayLayers.splice(insertIndex, 0, movedLayer);
    const originalOrder = originalDisplayLayers.map((layer) => layer.id).join('|');
    const nextOrder = nextDisplayLayers.map((layer) => layer.id).join('|');
    if (originalOrder === nextOrder) return;
    commitHistory();
    updateProject(withLayers(project, nextDisplayLayers.reverse(), project.activeLayerId));
  }

  function selectLayer(layerId: string) {
    if (!project.settings.showActiveLayerOnly) {
      updateProject({ ...project, activeLayerId: layerId });
      return;
    }
    const soloLayers = layers.map((layer) => ({
      ...layer,
      visible: layer.id === layerId,
    }));
    updateProject({
      ...project,
      activeLayerId: layerId,
      layers: soloLayers,
      cells: composeVisibleCells(soloLayers, project.width, project.height),
    });
  }

  function setBeadsPerPack(value: number) {
    updateProject({
      ...project,
      settings: {
        ...project.settings,
        beadsPerPack: clampInteger(value, 1, 10000),
      },
    });
  }


  function stepBeadsPerPack(direction: -1 | 1) {
    const current = project.settings.beadsPerPack;
    const step = 500;
    const next =
      direction > 0
        ? current % step === 0
          ? current + step
          : Math.ceil(current / step) * step
        : current % step === 0
          ? current - step
          : Math.floor(current / step) * step;
    setBeadsPerPack(Math.max(step, next));
  }

  const layers = project.layers?.length ? project.layers : createProject(project.width, project.height).layers;
  const activeLayer = layers.find((layer) => layer.id === project.activeLayerId) ?? layers[0];
  const countedLayers = layers.filter((layer) => layer.includeInUsage);
  useEffect(() => {
    setCopySelectionIndices([]);
    setAdjustments(defaultAdjustments);
    adjustmentSessionRef.current = { layerId: null, baseCells: [] };
  }, [activeLayer.id, project.width, project.height]);
  const displayProject = useMemo(() => {
    if (!project.settings.showActiveLayerOnly) {
      return project;
    }
    const displayLayers = layers.map((layer) => ({
      ...layer,
      visible: layer.id === activeLayer.id,
    }));
    return {
      ...project,
      layers: displayLayers,
      cells: composeVisibleCells(displayLayers, project.width, project.height),
    };
  }, [activeLayer.id, layers, project]);
  const shapeLabel = {
    line: text.shapeLine,
    rectangle: text.shapeRectangle,
    square: text.shapeSquare,
    ellipse: text.shapeEllipse,
    circle: text.shapeCircle,
    triangle: text.shapeTriangle,
    arrow: text.shapeArrow,
  } satisfies Record<ShapeKind, string>;
  const arrowLabel = {
    single: text.arrowSingle,
    double: text.arrowDouble,
    block: text.arrowBlock,
  } satisfies Record<ArrowKind, string>;
  const selectedSizePreset = sizePresets.find((item) => item.width === canvasWidth && item.height === canvasHeight)?.label ?? '';
  const defaultPrintNickname = useMemo(() => {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    return language === 'zh' ? `拼豆图纸_${stamp}` : `Perler_Beads_${stamp}`;
  }, [language]);

  function exportPrintPattern() {
    const exportOptions = {
      ...printExportOptions,
      projectName: printExportOptions.projectName?.trim() || defaultPrintNickname,
      layerLabelPrefix: language === 'en' ? 'Layer' : '图层',
    };
    if (printExportOptions.format === 'pdf') {
      downloadPrintPdf(project, exportOptions);
    } else {
      downloadPrintPng(project, exportOptions);
    }
    setShowPrintExportPanel(false);
  }

  return (
    <main
      className="app-shell"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = [...event.dataTransfer.files].find((item) => item.type.startsWith('image/'));
        if (file) handleImageFile(file);
      }}
    >
      <input
        ref={fileInputRef}
        className="hidden-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) handleImageFile(file);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={referenceInputRef}
        className="hidden-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) handleReferenceImageFile(file);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={jsonInputRef}
        className="hidden-input"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) importJson(file).catch((error) => setNotice(error.message));
          event.currentTarget.value = '';
        }}
      />

      <header className="topbar">
        <div className="brand-lockup" aria-label="Perler Beads Generator">
          <span className="logo-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <div>
            <strong>{text.appName}</strong>
            <small>
              {text.status(project.width, project.height, totalBeads, usage.length)}
            </small>
          </div>
        </div>

        <div className="topbar-workspace">
          <div className="topbar-params canvas-params" aria-label="Canvas controls">
            <span className="topbar-control-label">{text.board}</span>
            <div className="topbar-dimension-group">
              <input aria-label="Canvas width" type="number" min={8} max={180} value={canvasWidth} onChange={(event) => setCanvasWidth(Number(event.target.value))} />
              <span className="size-times">×</span>
              <input aria-label="Canvas height" type="number" min={8} max={180} value={canvasHeight} onChange={(event) => setCanvasHeight(Number(event.target.value))} />
            </div>
            <select className="canvas-preset-select" aria-label="Canvas preset" value={selectedSizePreset || ''} onChange={(event) => applyPreset(event.target.value)}>
              <option value="" disabled hidden>{text.commonSizes}</option>
              {sizePresets.map((preset) => (
                <option key={preset.label} value={preset.label}>{preset.label}</option>
              ))}
            </select>
            <button className="canvas-apply-button" onClick={resizeCanvas}>{text.apply}</button>
          </div>

          <div className="topbar-command-zone">
            <div className="topbar-actions export-actions">
              <div className="print-export-menu">
                <button
                  className="export-action-button primary-action print-export-button"
                  title={`${text.exportPatternTitle} PNG`}
                  aria-expanded={showPrintExportPanel}
                  onClick={() => setShowPrintExportPanel((value) => !value)}
                >
                  <ExportIcon />
                  <span>{text.exportPatternFull}</span>
                </button>
                {showPrintExportPanel && (
                  <div className="print-export-popover">
                    <div className="print-export-popover-header">
                      <strong>{text.printExportSettings}</strong>
                      <button
                        className="print-export-close"
                        type="button"
                        aria-label={text.close}
                        title={text.close}
                        onClick={() => setShowPrintExportPanel(false)}
                      >
                        <CloseIcon />
                      </button>
                    </div>
                    <label className="export-text-field">
                      <span>{text.exportFormat}</span>
                      <select
                        className="export-format-select"
                        value={printExportOptions.format ?? 'png'}
                        onChange={(event) => setPrintExportOptions((current) => ({ ...current, format: event.target.value as 'png' | 'pdf' }))}
                      >
                        <option value="png">PNG</option>
                        <option value="pdf">PDF</option>
                      </select>
                    </label>
                    <label className="export-text-field">
                      <span>{text.exportBounds}</span>
                      <select
                        className="export-format-select"
                        value={printExportOptions.exportBounds ?? 'pattern'}
                        onChange={(event) => setPrintExportOptions((current) => ({ ...current, exportBounds: event.target.value as 'pattern' | 'canvas' }))}
                      >
                        <option value="pattern">{text.exportPatternBounds}</option>
                        <option value="canvas">{text.exportCanvasBounds}</option>
                      </select>
                    </label>
                    <label className="export-text-field">
                      <span>{text.projectNickname}</span>
                      <input
                        value={printExportOptions.projectName ?? ''}
                        placeholder={defaultPrintNickname}
                        onChange={(event) => setPrintExportOptions((current) => ({ ...current, projectName: event.target.value }))}
                      />
                    </label>
                    <label className="export-text-field">
                      <span>{text.authorNickname}</span>
                      <input
                        value={printExportOptions.authorName ?? ''}
                        placeholder={text.optional}
                        onChange={(event) => setPrintExportOptions((current) => ({ ...current, authorName: event.target.value }))}
                      />
                    </label>
                    <label className="switch-row">
                      <span>{text.showColorCodes}</span>
                      <input
                        type="checkbox"
                        checked={printExportOptions.showColorCodes}
                        onChange={(event) => setPrintExportOptions((current) => ({ ...current, showColorCodes: event.target.checked }))}
                      />
                    </label>
                    <label className="switch-row">
                      <span>{text.showGuideLines}</span>
                      <input
                        type="checkbox"
                        checked={printExportOptions.showGuideLines}
                        onChange={(event) => setPrintExportOptions((current) => ({ ...current, showGuideLines: event.target.checked }))}
                      />
                    </label>
                    <button className="export-submit-button" onClick={exportPrintPattern}>
                      {text.exportNow} {(printExportOptions.format ?? 'png').toUpperCase()}
                    </button>
                  </div>
                )}
              </div>
              <button className="export-action-button" title={text.exportUsageTitle} onClick={exportUsageList}>{text.exportUsageFull}</button>
              <button className="export-action-button" title={text.exportRecordTitle} onClick={exportEditRecord}>{text.exportRecordFull}</button>
              <button className="export-action-button" title={text.importRecordTitle} onClick={() => jsonInputRef.current?.click()}>{text.importRecordFull}</button>
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <a
            className="github-link"
            href="https://github.com/Jett-Wu/Perler_Beads_Generator"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <GitHubIcon />
            <span>GitHub</span>
          </a>
          <div className="language-toggle" aria-label={text.language}>
            <button className={language === 'zh' ? 'active' : ''} onClick={() => setLanguage('zh')}>中</button>
            <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button>
          </div>
        </div>
      </header>

      <div className="project-toolbar" role="toolbar" aria-label={language === 'zh' ? '编辑操作' : 'Edit actions'}>
            <div className="project-actions">
              <button className="project-action-button primary-action" onClick={() => startBlank(52, 52)}><PlusIcon /><span>{text.new}</span></button>
              <button className="project-action-button" onClick={clearCanvas}><TrashIcon /><span>{text.clear}</span></button>
              <span className="project-action-divider" aria-hidden="true" />
              <button className="project-action-button history-action" onClick={undo} disabled={past.length === 0} title={`${text.undo} (Ctrl+Z / ⌘Z)`} aria-keyshortcuts="Control+Z Meta+Z"><UndoIcon /><span>{text.undo}</span></button>
              <button className="project-action-button history-action" onClick={redo} disabled={future.length === 0} title={`${text.redo} (Ctrl+Shift+Z / ⌘⇧Z / Ctrl+Y)`} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"><RedoIcon /><span>{text.redo}</span></button>
            </div>
      </div>

      <SourcePanel
        text={text}
        language={language}
        totalBeads={totalBeads}
        displayProject={displayProject}
        pendingFile={pendingFile}
        pendingImageUrl={pendingImageUrl}
        isGenerating={isGenerating}
        convertWidth={convertWidth}
        maxColors={maxColors}
        tolerance={tolerance}
        generationStyle={generationStyle}
        backgroundMode={backgroundMode}
        referenceFile={referenceFile}
        referenceImageUrl={referenceImageUrl}
        referenceVisible={referenceVisible}
        referenceOpacity={referenceOpacity}
        referenceAdjusting={referenceAdjusting}
        referencePlacement={referencePlacement}
        imageHelpProps={imageHelpProps}
        onChooseImage={() => fileInputRef.current?.click()}
        onChooseReference={() => referenceInputRef.current?.click()}
        onConvertWidthChange={setConvertWidth}
        onMaxColorsChange={setMaxColors}
        onToleranceChange={setTolerance}
        onGenerationStyleChange={setGenerationStyle}
        onBackgroundModeChange={setBackgroundMode}
        onReferenceVisibleChange={setReferenceVisible}
        onReferenceOpacityChange={setReferenceOpacity}
        onReferenceAdjustingChange={setReferenceAdjusting}
        onReferencePlacementChange={setReferencePlacement}
        onResetReferenceTransform={resetReferenceTransform}
      />

      <aside className="tool-rail">
        {tools.map((item) => (
          <button
            key={item.id}
            className={tool === item.id ? 'tool-button active' : 'tool-button'}
            aria-label={text.tools[item.id].title}
            title={`${text.tools[item.id].title} (${item.shortcut}) — ${text.tools[item.id].hint}`}
            aria-keyshortcuts={item.shortcut.toLowerCase()}
            aria-pressed={tool === item.id}
            type="button"
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse') return;
              event.preventDefault();
              activateTool(item.id);
            }}
            onClick={() => activateTool(item.id)}
          >
            <ToolIcon tool={item.id} />
            <span>{text.tools[item.id].title}</span>
          </button>
        ))}
        {tool === 'pencil' && showPencilOptions && (
          <div className="tool-options pencil-options" onMouseLeave={() => setShowPencilOptions(false)}>
            <div className="right-click-toggle compact" aria-label={text.rightClick}>
              <span className="field-label-with-help">
                {text.rightClick}
                <span className="help-dot mini" data-tooltip={text.rightClickHint} aria-label={text.rightClickHint} tabIndex={0}>?</span>
              </span>
              <div>
                {(['pan', 'erase'] as RightClickAction[]).map((action) => (
                  <button
                    key={action}
                    className={project.settings.rightClickAction === action ? 'active' : ''}
                    type="button"
                    aria-pressed={project.settings.rightClickAction === action}
                    onClick={() =>
                      updateProject({
                        ...project,
                        settings: { ...project.settings, rightClickAction: action },
                      })
                    }
                  >
                    {action === 'pan' ? text.pan : text.erase}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tool === 'eraser' && showEraserOptions && (
          <div className="tool-options eraser-options" onMouseLeave={() => setShowEraserOptions(false)}>
            <div className="tool-options-header">
              <span>{text.eraserSize}</span>
              <strong>{text.brushCells(eraserSize)}</strong>
            </div>
            <div className="brush-preview" aria-hidden="true">
              {eraserSize > 0 ? (
                <span style={{ width: `${10 + eraserSize * 3}px`, height: `${10 + eraserSize * 3}px` }} />
              ) : (
                <span className="brush-preview-dot" />
              )}
            </div>
            <input
              aria-label={text.eraserSize}
              type="range"
              min={0}
              max={9}
              step={0.5}
              value={eraserSize}
              onChange={(event) => setEraserSize(Number(event.target.value))}
            />
          </div>
        )}
        {tool === 'remove' && showRemoveOptions && (
          <div className="tool-options remove-options" onMouseLeave={() => setShowRemoveOptions(false)}>
            <div className="right-click-toggle compact remove-scope-toggle" aria-label={text.removeScope}>
              <span>{text.removeScope}</span>
              <div>
                {(['same-connected', 'all-same-color', 'connected'] as RemoveMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={removeMode === mode ? 'active' : ''}
                    type="button"
                    aria-pressed={removeMode === mode}
                    onClick={() => setRemoveMode(mode)}
                  >
                    {mode === 'same-connected'
                      ? text.removeSameConnected
                      : mode === 'all-same-color'
                        ? text.removeAllSameColor
                        : text.removeConnected}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tool === 'move' && showMoveOptions && (
          <div className="tool-options move-options" onMouseLeave={() => setShowMoveOptions(false)}>
            <div className="right-click-toggle compact" aria-label={text.moveScope}>
              <span>{text.moveScope}</span>
              <div>
                {(['layer', 'partial'] as MoveMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={moveMode === mode ? 'active' : ''}
                    type="button"
                    aria-pressed={moveMode === mode}
                    onClick={() => setMoveMode(mode)}
                  >
                    {mode === 'layer' ? text.moveLayer : text.movePartial}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {(tool === 'copy' || tool === 'paste') && showClipboardOptions && (
          <div
            className={`tool-options clipboard-options ${tool === 'copy' ? 'copy-options' : 'paste-options'}`}
            onMouseLeave={() => setShowClipboardOptions(false)}
          >
            {tool === 'copy' && (
              <div className="right-click-toggle compact clipboard-mode-toggle" aria-label={text.copyScope}>
                <span>{text.copyScope}</span>
                <div>
                  {(['connected', 'selection'] as CopyMode[]).map((mode) => (
                    <button
                      key={mode}
                      className={copyMode === mode ? 'active' : ''}
                      type="button"
                      aria-pressed={copyMode === mode}
                      onClick={() => {
                        setCopyMode(mode);
                        setCopySelectionIndices([]);
                      }}
                    >
                      {mode === 'connected' ? text.copyConnected : text.copySelection}
                    </button>
                  ))}
                </div>
                {copyMode === 'selection' && <p className="tool-hint compact-hint">{text.copySelectionHint}</p>}
              </div>
            )}
            <div className="clipboard-tool-header">
              <div>
                <strong>{text.clipboardPreview}</strong>
                {clipboardPattern && (
                  <span>{text.clipboardSize(clipboardPattern.width, clipboardPattern.height, clipboardPattern.cells.filter(Boolean).length)}</span>
                )}
              </div>
              <button
                className="clipboard-reset-button"
                type="button"
                aria-label={text.resetClipboard}
                title={text.resetClipboard}
                disabled={!clipboardPattern && copySelectionIndices.length === 0}
                onClick={resetClipboard}
              >
                <ResetIcon />
              </button>
            </div>
            {clipboardPattern ? (
              <ClipboardPreview pattern={clipboardPattern} />
            ) : (
              <div className="clipboard-empty">{text.clipboardEmpty}</div>
            )}
          </div>
        )}
        {tool === 'mirror' && showMirrorOptions && (
          <div className="tool-options mirror-options" onMouseLeave={() => setShowMirrorOptions(false)}>
            <div className="right-click-toggle compact" aria-label={text.moveScope}>
              <span>{text.moveScope}</span>
              <div>
                {(['layer', 'partial'] as MoveMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={mirrorMode === mode ? 'active' : ''}
                    type="button"
                    aria-pressed={mirrorMode === mode}
                    onClick={() => setMirrorMode(mode)}
                  >
                    {mode === 'layer' ? text.moveLayer : text.movePartial}
                  </button>
                ))}
              </div>
            </div>
            <div className="right-click-toggle compact" aria-label={text.mirrorDirection}>
              <span>{text.mirrorDirection}</span>
              <div>
                {(['horizontal', 'vertical'] as MirrorDirection[]).map((direction) => (
                  <button
                    key={direction}
                    className={mirrorDirection === direction ? 'active' : ''}
                    type="button"
                    aria-pressed={mirrorDirection === direction}
                    onClick={() => setMirrorDirection(direction)}
                  >
                    {direction === 'horizontal' ? text.mirrorHorizontal : text.mirrorVertical}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tool === 'shape' && showShapeOptions && (
          <div className="tool-options shape-options" onMouseLeave={() => setShowShapeOptions(false)}>
            <div className="right-click-toggle compact" aria-label={text.shapeStyle}>
              <span>{text.shapeStyle}</span>
              <div>
                {(['outline', 'filled'] as ShapeFillMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={shapeFillMode === mode ? 'active' : ''}
                    type="button"
                    aria-pressed={shapeFillMode === mode}
                    disabled={shapeKind === 'line' || shapeKind === 'arrow'}
                    onClick={() => setShapeFillMode(mode)}
                  >
                    {mode === 'outline' ? text.shapeOutline : text.shapeFilled}
                  </button>
                ))}
              </div>
            </div>
            <div className="shape-picker" aria-label={text.shapeType}>
              <span>{text.shapeType}</span>
              <div>
                {(['line', 'rectangle', 'square', 'ellipse', 'circle', 'triangle', 'arrow'] as ShapeKind[]).map((kind) => (
                  <button
                    key={kind}
                    className={shapeKind === kind ? 'active' : ''}
                    type="button"
                    aria-pressed={shapeKind === kind}
                    onClick={() => setShapeKind(kind)}
                  >
                    <ShapeOptionIcon shape={kind} />
                    <span>{shapeLabel[kind]}</span>
                  </button>
                ))}
              </div>
            </div>
            {shapeKind === 'arrow' && (
              <div className="shape-picker arrow-picker" aria-label={text.arrowStyle}>
                <span>{text.arrowStyle}</span>
                <div>
                  {(['single', 'double', 'block'] as ArrowKind[]).map((kind) => (
                    <button
                      key={kind}
                      className={arrowKind === kind ? 'active' : ''}
                      type="button"
                      aria-pressed={arrowKind === kind}
                      onClick={() => setArrowKind(kind)}
                    >
                      <ArrowOptionIcon arrow={kind} />
                      <span>{arrowLabel[kind]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {tool === 'text' && showTextOptions && (
          <div className="tool-options text-options">
            <label className="text-tool-field">
              <span className="text-field-title">
                {text.textContent}
                <button
                  className="tool-options-close"
                  type="button"
                  aria-label={text.close}
                  title={text.close}
                  onClick={() => setShowTextOptions(false)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7l10 10" />
                    <path d="M17 7L7 17" />
                  </svg>
                </button>
              </span>
              <input
                type="text"
                maxLength={32}
                value={textToolValue}
                placeholder={text.textPlaceholder}
                onChange={(event) => setTextToolValue(event.target.value)}
              />
            </label>
            <div className="right-click-toggle compact" aria-label={text.textDirection}>
              <span>{text.textDirection}</span>
              <div>
                {(['horizontal', 'vertical'] as TextDirection[]).map((direction) => (
                  <button
                    key={direction}
                    className={textToolDirection === direction ? 'active' : ''}
                    type="button"
                    aria-pressed={textToolDirection === direction}
                    onClick={() => setTextToolDirection(direction)}
                  >
                    {direction === 'horizontal' ? text.textHorizontal : text.textVertical}
                  </button>
                ))}
              </div>
            </div>
            <div className="tool-options-header">
              <span>{text.textSize}</span>
              <label className="tool-number-field" aria-label={text.textSize}>
                <input
                  type="number"
                  min={5}
                  max={72}
                  step={1}
                  value={textToolSize}
                  onChange={(event) => setTextToolSize(Math.min(72, Math.max(5, Number(event.target.value) || 5)))}
                />
                <span>{language === 'zh' ? '格' : 'cells'}</span>
              </label>
            </div>
            <input
              aria-label={text.textSize}
              type="range"
              min={5}
              max={72}
              step={1}
              value={textToolSize}
              onChange={(event) => setTextToolSize(Number(event.target.value))}
            />
            <div className="tool-options-header">
              <span>{text.textSpacing}</span>
              <label className="tool-number-field" aria-label={text.textSpacing}>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={1}
                  value={textToolSpacing}
                  onChange={(event) => setTextToolSpacing(Math.min(24, Math.max(0, Number(event.target.value) || 0)))}
                />
                <span>{language === 'zh' ? '格' : 'cells'}</span>
              </label>
            </div>
            <input
              aria-label={text.textSpacing}
              type="range"
              min={0}
              max={24}
              step={1}
              value={textToolSpacing}
              onChange={(event) => setTextToolSpacing(Number(event.target.value))}
            />
          </div>
        )}
        {tool === 'pan' && showPanOptions && (
          <div className="tool-options pan-options" onMouseLeave={() => setShowPanOptions(false)}>
            <div className="tool-options-header">
              <strong>{text.tools.pan.title}</strong>
            </div>
            <p className="tool-hint">{text.panToolHint}</p>
          </div>
        )}
      </aside>

      <WorkspaceCanvas
        project={displayProject}
        selectedColorId={selectedColorId}
        highlightedColorId={highlightedColorId}
        highlightedCellIndices={isolatedCellIndices}
        formatColorCode={displayCodeById}
        tool={tool}
        eraserSize={eraserSize}
        moveMode={moveMode}
        removeMode={removeMode}
        mirrorMode={mirrorMode}
        mirrorDirection={mirrorDirection}
        shapeKind={shapeKind}
        shapeFillMode={shapeFillMode}
        arrowKind={arrowKind}
        textToolValue={textToolValue}
        textToolDirection={textToolDirection}
        textToolSize={textToolSize}
        textToolSpacing={textToolSpacing}
        onTextToolSizeChange={setTextToolSize}
        referenceImageUrl={referenceImageUrl}
        referenceImageVisible={referenceVisible && !isGenerating}
        referenceImageOpacity={referenceOpacity}
        referenceImageScale={referenceScale}
        referenceImageOffset={referenceOffset}
        referenceImageAdjusting={referenceAdjusting && referenceVisible && !isGenerating}
        referenceImagePlacement={referencePlacement}
        referenceAdjustHint={text.referenceAdjustHint}
        onReferenceOffsetChange={setReferenceOffset}
        onReferenceScaleChange={setReferenceScale}
        onCommitStart={() => {
          setShowPencilOptions(false);
          setShowEraserOptions(false);
          setShowRemoveOptions(false);
          setShowMoveOptions(false);
          setShowMirrorOptions(false);
          setShowShapeOptions(false);
          setShowTextOptions(tool === 'text');
          setShowClipboardOptions(false);
          setShowPanOptions(false);
          commitHistory();
        }}
        onCellsChange={updateCells}
        onReplaceColor={replaceColor}
        clipboardPattern={clipboardPattern}
        copyMode={copyMode}
        copySelectionIndices={copySelectionIndices}
        onCopyPattern={(pattern, switchToPaste = true) => {
          const beads = pattern.cells.filter(Boolean).length;
          setClipboardPattern(pattern);
          if (switchToPaste) setTool('paste');
          setShowPencilOptions(false);
          setShowEraserOptions(false);
          setShowRemoveOptions(false);
          setShowMoveOptions(false);
          setShowMirrorOptions(false);
          setShowShapeOptions(false);
          setShowTextOptions(false);
          setShowClipboardOptions(false);
          setShowPanOptions(false);
          setNotice(text.copiedPattern(pattern.width, pattern.height, beads));
        }}
        onCopySelectionChange={(indices, pattern) => {
          setCopySelectionIndices(indices);
          setClipboardPattern(pattern);
          setNotice(pattern ? text.copySelectionUpdated(pattern.cells.filter(Boolean).length) : text.clipboardReset);
        }}
        onPastePattern={() => setNotice(text.pastedPattern)}
        onPickColor={(colorId) => {
          selectColor(colorId);
          setTool('pencil');
          setShowPencilOptions(false);
          setShowEraserOptions(false);
          setShowRemoveOptions(false);
          setShowMoveOptions(false);
          setShowMirrorOptions(false);
          setShowShapeOptions(false);
          setShowTextOptions(false);
          setShowClipboardOptions(false);
          setShowPanOptions(false);
          setNotice(language === 'zh' ? '已从画布拾取颜色。' : 'Color picked from canvas.');
        }}
        onHover={setHoverCell}
        fitLabel={text.fit}
        canEdit={!activeLayer.locked}
        lockedHint={text.lockedCanvasHint}
      />

      <aside className="right-panel">
        <div className="right-tabs" role="tablist" aria-label="Right panel">
          <button
            className={rightTab === 'palette' ? 'active' : ''}
            role="tab"
            aria-selected={rightTab === 'palette'}
            onClick={() => setRightTab('palette')}
          >
            {text.palette}
          </button>
          <button
            className={rightTab === 'layers' ? 'active' : ''}
            role="tab"
            aria-selected={rightTab === 'layers'}
            onClick={() => setRightTab('layers')}
          >
            {text.layers}
          </button>
          <button
            className={rightTab === 'usage' ? 'active' : ''}
            role="tab"
            aria-selected={rightTab === 'usage'}
            onClick={() => setRightTab('usage')}
          >
            {text.usage}
          </button>
          <button
            className={rightTab === 'adjustments' ? 'active' : ''}
            role="tab"
            aria-selected={rightTab === 'adjustments'}
            onClick={() => setRightTab('adjustments')}
          >
            {text.adjustments}
          </button>
        </div>

        <section className="panel-section status-section">
          <div>
            <strong>{notice}</strong>
            <span>
              {text.panelStatus(project.width, project.height, usage.length, totalBeads, boardCount)}
            </span>
          </div>
          <span className="status-pill">{text.tools[tool].title}</span>
        </section>

        <details className="panel-section canvas-colors-section" open>
          <summary className="canvas-colors-toggle">
            <h2>{language === 'zh' ? '画布已用色号' : 'Colors used on canvas'}</h2>
            <span>{usage.length} {language === 'zh' ? '色' : 'colors'}</span>
          </summary>
          <div className="usage-list canvas-colors-list">
            {usage.map((row) => (
              <button
                key={row.color.id}
                type="button"
                onClick={() => selectColor(row.color.id)}
                onMouseEnter={() => setHighlightedColorId(row.color.id)}
                onMouseLeave={() => setHighlightedColorId(null)}
              >
                <span className="usage-chip" style={{ backgroundColor: row.color.hex }} />
                <span className="usage-color-info">
                  <strong>{displayCode(row.color)}</strong>
                  <small>{displayName(row.color)}</small>
                </span>
                <span className="usage-count">
                  <strong>{text.layerBeadCount(row.count)}</strong>
                </span>
              </button>
            ))}
            {usage.length === 0 && <div className="usage-empty">{text.noUsage}</div>}
          </div>
        </details>

        {rightTab === 'palette' && (
          <section className="panel-section panel-tab-body palette-section">
            <h2>{text.palette}</h2>
            <div className="palette-selected-card">
              <span style={{ backgroundColor: selectedColor?.hex }} />
              <div className="palette-selected-main">
                <strong>{selectedColor ? displayCode(selectedColor) : ''}</strong>
                <small>{selectedColor ? displayName(selectedColor) : ''}</small>
              </div>
              <div className="palette-selected-hex">
                <small>{selectedColor?.hex}</small>
              </div>
            </div>
            <div className="recent-colors-field">
              <span>{text.recentColors}</span>
              <div className="recent-color-row">
                {recentColors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className={selectedColorId === color.id ? 'active' : ''}
                    title={`${displayCode(color)} ${displayName(color)}`}
                    aria-label={`${text.recentColors} ${displayCode(color)}`}
                    onClick={() => selectColor(color.id, { updateRecent: false })}
                  >
                    <span style={{ backgroundColor: color.hex }} />
                    <small>{displayCode(color)}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="readonly-brand-field">
              {text.brandCodes}
              <select value={paletteMode} onChange={(event) => setPaletteMode(event.target.value as PaletteMode)}>
                <option value="basic">{text.mardBasic}</option>
                <option value="complete">{text.mardComplete}</option>
              </select>
            </div>
            <div className="palette-filter" aria-label="Palette groups">
              {paletteGroups.map((group) => (
                <button
                  key={group.id}
                  className={paletteGroup === group.id ? 'active' : ''}
                  onClick={() => setPaletteGroup(group.id)}
                >
                  {group.label}
                </button>
              ))}
            </div>
            <div className="palette-grid">
              {visiblePalette.map((color) => (
                <button
                  key={color.id}
                  className={selectedColorId === color.id ? 'swatch active' : 'swatch'}
                  title={`${displayCode(color)} ${displayName(color)}`}
                  onClick={() => {
                    selectColor(color.id);
                  }}
                >
                  <span style={{ backgroundColor: color.hex }} />
                  <small>{displayCode(color)}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {rightTab === 'layers' && (
          <LayerPanel
            text={text}
            layers={layers}
            activeLayerId={activeLayer.id}
            showActiveLayerOnly={project.settings.showActiveLayerOnly}
            layerDisplayName={layerDisplayName}
            layerMetaText={layerMetaText}
            onAddLayer={addLayer}
            onToggleActiveLayerOnly={toggleActiveLayerOnly}
            onSelectLayer={selectLayer}
            onUpdateLayer={updateLayer}
            onDuplicateLayer={duplicateLayer}
            onDeleteLayer={deleteLayer}
            onMoveLayer={moveLayer}
            onSaveLayerName={saveLayerName}
          />
        )}

        {rightTab === 'usage' && (
          <section className="panel-section panel-tab-body usage-section">
            <h2>{text.usage}</h2>
            <div className="usage-overview">
              <div>
                <span>{text.totalBeadsLabel}</span>
                <strong>{totalBeads}</strong>
              </div>
              <div>
                <span>{text.colorTypes}</span>
                <strong>{usage.length}</strong>
              </div>
              <div>
                <span>{text.estimatedPacks}</span>
                <strong>{totalPacks}</strong>
              </div>
            </div>
            <label className="usage-pack-setting">
              <span>{text.beadsPerPack}</span>
              <div className="usage-pack-control">
                <div className="usage-pack-stepper">
                  <button
                    type="button"
                    onClick={() => stepBeadsPerPack(-1)}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    step={500}
                    value={project.settings.beadsPerPack}
                    onChange={(event) => setBeadsPerPack(Number(event.target.value))}
                  />
                  <button
                    type="button"
                    onClick={() => stepBeadsPerPack(1)}
                  >
                    +
                  </button>
                </div>
                <small>{text.perPackUnit}</small>
              </div>
            </label>
            <div className="usage-summary-card">
              <div className="usage-summary-head">
                <strong>{text.countedLayerTitle}</strong>
                <span>{text.countedLayers(countedLayers.length)}</span>
              </div>
              <div className="usage-layer-actions">
                <button
                  type="button"
                  className={countedLayers.length === layers.length ? 'active' : ''}
                  onClick={() => updateUsageLayerSelection(new Set(layers.map((layer) => layer.id)))}
                >
                  {text.countAllLayers}
                </button>
                <button
                  type="button"
                  className={countedLayers.length === 1 && countedLayers[0]?.id === activeLayer.id ? 'active' : ''}
                  onClick={() => updateUsageLayerSelection(new Set([activeLayer.id]))}
                >
                  {text.countCurrentLayer}
                </button>
              </div>
              <div className="usage-layer-chips">
                {layers.map((layer) => {
                  const isIncluded = layer.includeInUsage;
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      className={isIncluded ? 'active' : ''}
                      aria-pressed={isIncluded}
                      onClick={() => toggleUsageLayer(layer.id)}
                    >
                      {layerDisplayName(layer, layers.findIndex((item) => item.id === layer.id))}
                    </button>
                  );
                })}
              </div>
              {countedLayers.length === 0 && <div className="usage-no-layers">{text.noCountedLayers}</div>}
              {(usage.length > 32 || isolatedBeads > 0) && (
                <div className="usage-notes">
                  {usage.length > 32 && <span>{text.manyColors}</span>}
                  {isolatedBeads > 0 && (
                    <span className="usage-note-line">
                      <span>{text.isolatedBeads(isolatedBeads)}</span>
                      <button
                        className={showIsolatedBeads ? 'usage-note-eye active' : 'usage-note-eye'}
                        type="button"
                        title={showIsolatedBeads ? text.hideIsolatedBeads : text.showIsolatedBeads}
                        aria-label={showIsolatedBeads ? text.hideIsolatedBeads : text.showIsolatedBeads}
                        aria-pressed={showIsolatedBeads}
                        onClick={() => setShowIsolatedBeads((current) => !current)}
                      >
                        <EyeIcon visible={showIsolatedBeads} />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="usage-list">
              {usage.map((row) => (
                <button
                  key={row.color.id}
                  onMouseEnter={() => setHighlightedColorId(row.color.id)}
                  onMouseLeave={() => setHighlightedColorId(null)}
                >
                  <span className="usage-chip" style={{ backgroundColor: row.color.hex }} />
                  <span className="usage-color-info">
                    <strong>{displayCode(row.color)}</strong>
                    <small>{displayName(row.color)}</small>
                  </span>
                  <span className="usage-count">
                    <strong>{row.count}</strong>
                    <small>{row.packs} {text.packUnit}</small>
                  </span>
                </button>
              ))}
              {usage.length === 0 && <div className="usage-empty">{text.noUsage}</div>}
            </div>
          </section>
        )}

        {rightTab === 'adjustments' && (
          <AdjustmentPanel
            text={text}
            activeLayer={activeLayer}
            activeLayerName={layerDisplayName(activeLayer, layers.findIndex((item) => item.id === activeLayer.id))}
            adjustments={adjustments}
            colorCleanupStrength={colorCleanupStrength}
            layerColorLimit={layerColorLimit}
            onAdjustmentChange={updateAdjustment}
            onReset={resetAdjustments}
            onApplyEffect={applyLayerEffect}
            onColorCleanupStrengthChange={setColorCleanupStrength}
            onApplyColorCleanup={applyColorCleanup}
            onLayerColorLimitChange={setLayerColorLimit}
            onApplyLayerColorLimit={applyLayerColorLimit}
          />
        )}

        {rightTab === 'palette' && (
          <>
            <section className="panel-section view-section">
              <h2>{text.view}</h2>
            <div className="view-toggle-grid">
              <div className="view-shape-toggle" aria-label={text.beadShape}>
                <span>{text.beadShape}</span>
                <div>
                  <button
                    type="button"
                    className={project.settings.beadDisplayMode === 'bead' ? 'active' : ''}
                    aria-pressed={project.settings.beadDisplayMode === 'bead'}
                    onClick={() => updateProject({ ...project, settings: { ...project.settings, beadDisplayMode: 'bead' } })}
                  >
                    <span className="shape-choice-icon shape-choice-icon-round" aria-hidden="true" />
                    <span>{text.roundBeads}</span>
                  </button>
                  <button
                    type="button"
                    className={project.settings.beadDisplayMode === 'pixel' ? 'active' : ''}
                    aria-pressed={project.settings.beadDisplayMode === 'pixel'}
                    onClick={() => updateProject({ ...project, settings: { ...project.settings, beadDisplayMode: 'pixel' } })}
                  >
                    <span className="shape-choice-icon shape-choice-icon-square" aria-hidden="true" />
                    <span>{text.squareBeads}</span>
                  </button>
                </div>
              </div>
              <div className="view-row">
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={project.settings.showGrid}
                    onChange={(event) =>
                      updateProject({ ...project, settings: { ...project.settings, showGrid: event.target.checked } })
                    }
                  />
                  {text.grid}
                </label>
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={project.settings.showCoordinates}
                    onChange={(event) =>
                      updateProject({ ...project, settings: { ...project.settings, showCoordinates: event.target.checked } })
                    }
                  />
                  {text.coordinates}
                </label>
              </div>
              <div className="view-row">
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={project.settings.showColorCodes}
                    onChange={(event) =>
                      updateProject({ ...project, settings: { ...project.settings, showColorCodes: event.target.checked } })
                    }
                  />
                  {text.showColorCodes}
                </label>
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={project.settings.showLayerOverlap}
                    onChange={(event) =>
                      updateProject({ ...project, settings: { ...project.settings, showLayerOverlap: event.target.checked } })
                    }
                  />
                  {text.layerOverlap}
                </label>
              </div>
            </div>
            </section>

            <section className="panel-section hover-section">
              <h2>{text.cell}</h2>
              {hoverCell ? (
                <span>
                  R{hoverCell.y + 1} C{hoverCell.x + 1} - {getColor(hoverCell.colorId)?.primaryCode ?? text.empty}
                </span>
              ) : (
                <span>{text.hoverBoard}</span>
              )}
            </section>
          </>
        )}
      </aside>
      {showImageGridEditor && pendingFile && (
        <ImageGridEditor
          file={pendingFile}
          initialWidth={convertWidth}
          language={language}
          onCancel={() => setShowImageGridEditor(false)}
          onConfirm={(width, height, corners) => {
            setShowImageGridEditor(false);
            void generateFromImage(width, height, corners);
          }}
        />
      )}
      {floatingHelp && (
        <div className="floating-help-tooltip" style={{ left: floatingHelp.left, top: floatingHelp.top }}>
          {floatingHelp.text}
        </div>
      )}
    </main>
  );
}



function resizeCells(
  cells: Array<string | null>,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
): Array<string | null> {
  const next = Array.from({ length: newWidth * newHeight }, () => null as string | null);
  const copyWidth = Math.min(oldWidth, newWidth);
  const copyHeight = Math.min(oldHeight, newHeight);
  for (let y = 0; y < copyHeight; y += 1) {
    for (let x = 0; x < copyWidth; x += 1) {
      next[y * newWidth + x] = cells[y * oldWidth + x] ?? null;
    }
  }
  return next;
}
