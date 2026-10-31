import { getColor } from '@/core/palette';
import type { ClipboardPattern } from '@/common/types';

export function ClipboardPreview({ pattern }: { pattern: ClipboardPattern }) {
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
        const color = colorId ? getColor(colorId) : null;
        return <span key={index} style={{ background: color?.hex ?? 'transparent' }} />;
      })}
    </div>
  );
}
