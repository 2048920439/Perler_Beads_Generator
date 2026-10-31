import type { BackgroundMode, GenerationStyle, ToolId } from '@/common/types';

export const tools: Array<{ id: ToolId; shortcut: string }> = [
  { id: 'pencil', shortcut: 'B' },
  { id: 'eraser', shortcut: 'E' },
  { id: 'fill', shortcut: 'G' },
  { id: 'remove', shortcut: 'D' },
  { id: 'recolor', shortcut: 'R' },
  { id: 'eyedropper', shortcut: 'I' },
  { id: 'move', shortcut: 'M' },
  { id: 'copy', shortcut: 'C' },
  { id: 'paste', shortcut: 'V' },
  { id: 'mirror', shortcut: 'F' },
  { id: 'shape', shortcut: 'U' },
  { id: 'text', shortcut: 'T' },
  { id: 'pan', shortcut: 'H' },
];

export const referenceShortcut = 'KeyO';
export const referenceLongPressDelay = 350;

export const sizePresets = [
  { label: '52 * 52', width: 52, height: 52 },
  { label: '78 * 78', width: 78, height: 78 },
  { label: '104 * 104', width: 104, height: 104 },
  { label: '156 * 156', width: 156, height: 156 },
];

export const defaultImportSettings = {
  width: 52,
  maxColors: 24,
  generationStyle: 'cartoon' as GenerationStyle,
  backgroundMode: 'keep' as BackgroundMode,
  tolerance: 32,
  speckleReduction: 0,
};

export const defaultColorId = 'mard-h7';
export const defaultRecentColorIds = ['mard-h7', 'mard-h2'];
export const defaultAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  hue: 0,
};

