import type { ClipboardPattern } from '@/common/types';
import { useService } from '@/service-core';
import { PaletteService } from '@/services/palette-service';

export function ClipboardPreview({ pattern }: { pattern: ClipboardPattern }) {
  const palette = useService(PaletteService);
  const maxSide = Math.max(pattern.width, pattern.height, 1);
  const beadSize = Math.max(3, Math.min(10, Math.floor(76 / maxSide)));
  return (
    <div
      className="clipboard-preview"
      style={{
        gridTemplateColumns: `repeat(${pattern.width}, ${beadSize}px)`,
        gridAutoRows: `${beadSize}px`,
      }}
      aria-hidden="true"
    >
      {pattern.cells.map((colorId, index) => {
        const color = palette.getColor(colorId);
        return <span key={index} style={{ background: color?.hex ?? 'transparent' }} />;
      })}
    </div>
  );
}
