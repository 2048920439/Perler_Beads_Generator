export function drawCellBoundarySet(
  context: CanvasRenderingContext2D,
  indices: number[],
  width: number,
  cellSize: number,
): void {
  if (indices.length === 0) return;
  const selected = new Set(indices);
  context.save();
  context.fillStyle = 'rgba(23, 101, 106, 0.045)';
  indices.forEach((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    context.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
  });
  context.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  context.lineWidth = Math.max(2.4, cellSize * 0.16);
  context.lineCap = 'square';
  context.lineJoin = 'miter';
  strokeCellBoundary(context, indices, selected, width, cellSize);
  context.strokeStyle = 'rgba(23, 101, 106, 0.92)';
  context.lineWidth = Math.max(1.2, cellSize * 0.075);
  strokeCellBoundary(context, indices, selected, width, cellSize);
  context.restore();
}

export function drawCopySelectionSet(
  context: CanvasRenderingContext2D,
  indices: number[],
  width: number,
  cellSize: number,
  alpha = 1,
): void {
  if (indices.length === 0) return;
  context.save();
  indices.forEach((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const centerX = x * cellSize + cellSize / 2;
    const centerY = y * cellSize + cellSize / 2;
    const radius = cellSize * 0.39;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(23, 101, 106, ${0.16 * alpha})`;
    context.fill();
    context.lineWidth = Math.max(2.2, cellSize * 0.13);
    context.strokeStyle = `rgba(255, 255, 255, ${0.92 * alpha})`;
    context.stroke();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.lineWidth = Math.max(1.25, cellSize * 0.075);
    context.strokeStyle = `rgba(23, 101, 106, ${0.96 * alpha})`;
    context.stroke();
    context.beginPath();
    context.arc(centerX, centerY, Math.max(1.8, cellSize * 0.12), 0, Math.PI * 2);
    context.fillStyle = `rgba(23, 101, 106, ${0.9 * alpha})`;
    context.fill();
  });
  context.restore();
}

function strokeCellBoundary(
  context: CanvasRenderingContext2D,
  indices: number[],
  selected: Set<number>,
  width: number,
  cellSize: number,
): void {
  indices.forEach((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const left = x * cellSize;
    const top = y * cellSize;
    const right = left + cellSize;
    const bottom = top + cellSize;
    const topNeighbor = index - width;
    const bottomNeighbor = index + width;
    const leftNeighbor = x > 0 ? index - 1 : -1;
    const rightNeighbor = x < width - 1 ? index + 1 : -1;
    if (!selected.has(topNeighbor)) {
      context.beginPath();
      context.moveTo(left, top);
      context.lineTo(right, top);
      context.stroke();
    }
    if (!selected.has(rightNeighbor)) {
      context.beginPath();
      context.moveTo(right, top);
      context.lineTo(right, bottom);
      context.stroke();
    }
    if (!selected.has(bottomNeighbor)) {
      context.beginPath();
      context.moveTo(left, bottom);
      context.lineTo(right, bottom);
      context.stroke();
    }
    if (!selected.has(leftNeighbor)) {
      context.beginPath();
      context.moveTo(left, top);
      context.lineTo(left, bottom);
      context.stroke();
    }
  });
}

export function drawCellSet(
  context: CanvasRenderingContext2D,
  indices: number[],
  width: number,
  cellSize: number,
  style: { fill?: string; stroke: string; lineWidth: number },
): void {
  if (indices.length === 0) return;
  context.save();
  if (style.fill) context.fillStyle = style.fill;
  context.strokeStyle = style.stroke;
  context.lineWidth = style.lineWidth;
  indices.forEach((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const left = x * cellSize;
    const top = y * cellSize;
    if (style.fill) context.fillRect(left + 1, top + 1, cellSize - 2, cellSize - 2);
    context.strokeRect(left + 1.5, top + 1.5, cellSize - 3, cellSize - 3);
  });
  context.restore();
}
