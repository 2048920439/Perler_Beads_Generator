export function almostSamePoint(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

export function uniqueInBounds(points: Array<{ x: number; y: number }>, width: number, height: number): number[] {
  const seen = new Set<number>();
  points.forEach(({ x, y }) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    seen.add(y * width + x);
  });
  return [...seen];
}

export function linePoints(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const steps = Math.max(dx, dy, 1);
  for (let step = 0; step <= steps; step += 1) {
    points.push({
      x: Math.round(x0 + ((x1 - x0) * step) / steps),
      y: Math.round(y0 + ((y1 - y0) * step) / steps),
    });
  }
  return points;
}
