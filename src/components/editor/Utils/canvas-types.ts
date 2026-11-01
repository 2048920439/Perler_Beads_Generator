import type { ArrowKind, PaletteColor, ShapeFillMode, ShapeKind } from '@/common/types';

export type PointerGridPoint = {
  cell: { x: number; y: number } | null;
  gridX: number;
  gridY: number;
};

export type ShapeDraft = {
  kind: ShapeKind;
  fillMode: ShapeFillMode;
  arrowKind: ArrowKind;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export type ColorResolver = (colorId: string | null) => PaletteColor | undefined;
