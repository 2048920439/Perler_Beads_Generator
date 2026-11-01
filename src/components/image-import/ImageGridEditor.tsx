'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ui, type Language } from '@/config/localization';

export type ImagePoint = { x: number; y: number };
export type GridCorners = [ImagePoint, ImagePoint, ImagePoint, ImagePoint];

type Props = {
  file: File;
  initialWidth: number;
  onCancel: () => void;
  onConfirm: (width: number, height: number, corners: GridCorners) => void;
  language: Language;
};

type View = { scale: number; x: number; y: number };
type Drag = { kind: 'pan' | 'corner' | 'pinch'; pointerId: number; startX: number; startY: number; origin: View; corner?: number; distance?: number };

export function ImageGridEditor({ file, initialWidth, onCancel, onConfirm, language }: Props) {
  const labels = ui[language].imageGrid;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [columns, setColumns] = useState(Math.max(8, Math.min(180, initialWidth)));
  const [columnsInput, setColumnsInput] = useState(String(Math.max(8, Math.min(180, initialWidth))));
  const [rows, setRows] = useState(52);
  const [rowsInput, setRowsInput] = useState('52');
  const [corners, setCorners] = useState<GridCorners>([
    { x: 0.08, y: 0.08 }, { x: 0.92, y: 0.08 }, { x: 0.92, y: 0.92 }, { x: 0.08, y: 0.92 },
  ]);

  useEffect(() => {
    const nextImage = new Image();
    const url = URL.createObjectURL(file);
    setImage(null);
    nextImage.onload = () => {
      setImage(nextImage);
      const initialColumns = clamp(initialWidth, 8, 180);
      const initialRows = Math.max(8, Math.min(180, Math.round(initialColumns * nextImage.naturalHeight / nextImage.naturalWidth)));
      setRows(initialRows);
      setRowsInput(String(initialRows));
    };
    nextImage.src = url;
    return () => {
      nextImage.onload = null;
      URL.revokeObjectURL(url);
    };
  }, [file, initialWidth]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  function commitColumnsInput() {
    const parsed = Number(columnsInput);
    const next = columnsInput.trim() && Number.isFinite(parsed) ? clamp(parsed, 8, 180) : columns;
    setColumns(next);
    setColumnsInput(String(next));
  }

  function commitRowsInput() {
    const parsed = Number(rowsInput);
    const next = rowsInput.trim() && Number.isFinite(parsed) ? clamp(parsed, 8, 180) : rows;
    setRows(next);
    setRowsInput(String(next));
  }

  const fitView = useCallback(() => {
    if (!image || !size.width || !size.height) return;
    const scale = Math.min((size.width - 48) / image.naturalWidth, (size.height - 48) / image.naturalHeight);
    setView({ scale, x: (size.width - image.naturalWidth * scale) / 2, y: (size.height - image.naturalHeight * scale) / 2 });
  }, [image, size.width, size.height]);

  useEffect(() => { fitView(); }, [fitView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.scale, view.scale);
    ctx.drawImage(image, 0, 0);
    const pts = corners.map((p) => ({ x: p.x * image.naturalWidth, y: p.y * image.naturalHeight }));
    const left = pts[0].x;
    const top = pts[0].y;
    const right = pts[2].x;
    const bottom = pts[2].y;
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(51, 190, 154, 0.09)';
    ctx.fill();
    ctx.strokeStyle = '#35d2a7';
    ctx.lineWidth = 1.5 / view.scale;
    ctx.stroke();
    ctx.beginPath();
    for (let x = 1; x < columns; x += 1) {
      const gridX = left + ((right - left) * x) / columns;
      ctx.moveTo(gridX, top); ctx.lineTo(gridX, bottom);
    }
    for (let y = 1; y < rows; y += 1) {
      const gridY = top + ((bottom - top) * y) / rows;
      ctx.moveTo(left, gridY); ctx.lineTo(right, gridY);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.68)';
    ctx.lineWidth = 0.7 / view.scale;
    ctx.stroke();
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7 / view.scale, 0, Math.PI * 2);
      ctx.fillStyle = '#35d2a7'; ctx.fill();
      ctx.lineWidth = 2 / view.scale; ctx.strokeStyle = '#fff'; ctx.stroke();
    });
    ctx.restore();
  }, [image, size, view, corners, columns, rows]);

  function toImagePoint(clientX: number, clientY: number): ImagePoint | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!image || !rect) return null;
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.scale / image.naturalWidth, y: (clientY - rect.top - v.y) / v.scale / image.naturalHeight };
  }

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!image) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      dragRef.current = {
        kind: 'pinch',
        pointerId: event.pointerId,
        startX: (a.x + b.x) / 2,
        startY: (a.y + b.y) / 2,
        origin: viewRef.current,
        distance: Math.hypot(a.x - b.x, a.y - b.y),
      };
      return;
    }
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const p = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const transform = viewRef.current;
    const hit = corners.findIndex((corner) => {
      const x = transform.x + corner.x * image.naturalWidth * transform.scale;
      const y = transform.y + corner.y * image.naturalHeight * transform.scale;
      return Math.hypot(x - p.x, y - p.y) < 22;
    });
    dragRef.current = { kind: hit >= 0 ? 'corner' : 'pan', corner: hit >= 0 ? hit : undefined, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: transform };
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || (drag.kind !== 'pinch' && drag.pointerId !== event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (drag.kind === 'pinch' && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = canvasRef.current!.getBoundingClientRect();
      const factor = distance / Math.max(1, drag.distance ?? distance);
      const scale = clamp(drag.origin.scale * factor, 0.04, 8);
      const startMid = { x: drag.startX - rect.left, y: drag.startY - rect.top };
      const mid = { x: midpoint.x - rect.left, y: midpoint.y - rect.top };
      setView({
        scale,
        x: mid.x - (startMid.x - drag.origin.x) * scale / drag.origin.scale,
        y: mid.y - (startMid.y - drag.origin.y) * scale / drag.origin.scale,
      });
      return;
    }
    if (drag.kind === 'pan') {
      setView({ ...drag.origin, x: drag.origin.x + event.clientX - drag.startX, y: drag.origin.y + event.clientY - drag.startY });
    } else {
      const point = toImagePoint(event.clientX, event.clientY);
      if (point && drag.corner !== undefined) {
        setCorners((current) => resizeRectangleFromCorner(current, drag.corner!, {
          x: clamp(point.x, 0, 1),
          y: clamp(point.y, 0, 1),
        }));
      }
    }
  }

  function zoom(factor: number, cx = size.width / 2, cy = size.height / 2) {
    setView((current) => {
      const scale = clamp(current.scale * factor, 0.04, 8);
      return { scale, x: cx - (cx - current.x) * scale / current.scale, y: cy - (cy - current.y) * scale / current.scale };
    });
  }

  return (
    <div className="image-grid-editor" role="dialog" aria-modal="true" aria-label={labels.title}>
      <header className="image-grid-editor-header">
        <strong>{labels.title}</strong>
        <div className="image-grid-editor-actions">
          <button type="button" onClick={onCancel}>{labels.cancel}</button>
          <button type="button" className="primary" onClick={() => onConfirm(columns, rows, corners)}>{labels.apply}</button>
        </div>
      </header>
      <div className="image-grid-editor-body">
        <div className="image-grid-editor-stage" ref={stageRef}>
          <canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={(event) => { pointersRef.current.delete(event.pointerId); dragRef.current = null; }} onPointerCancel={(event) => { pointersRef.current.delete(event.pointerId); dragRef.current = null; }} onWheel={(event) => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); zoom(event.deltaY < 0 ? 1.12 : 0.89, event.clientX - rect.left, event.clientY - rect.top); }} />
          <div className="image-grid-zoom">
            <button type="button" title={labels.zoomOut} onClick={() => zoom(0.8)}>−</button>
            <button type="button" title={labels.zoomIn} onClick={() => zoom(1.25)}>+</button>
            <button type="button" title={labels.fit} onClick={fitView}>⌂</button>
          </div>
        </div>
        <aside className="image-grid-editor-sidebar">
          <p>{labels.dragHint}</p>
          <label>{labels.columns}<input type="text" inputMode="numeric" pattern="[0-9]*" value={columnsInput} onChange={(event) => setColumnsInput(event.target.value)} onBlur={commitColumnsInput} /></label>
          <label>{labels.rows}<input type="text" inputMode="numeric" pattern="[0-9]*" value={rowsInput} onChange={(event) => setRowsInput(event.target.value)} onBlur={commitRowsInput} /></label>
          <div className="image-grid-editor-legend"><span /><small>{labels.image} · {labels.grid}</small></div>
        </aside>
      </div>
    </div>
  );
}

function resizeRectangleFromCorner(corners: GridCorners, index: number, point: ImagePoint): GridCorners {
  const opposite = corners[(index + 2) % 4];
  const minX = Math.min(opposite.x, point.x);
  const maxX = Math.max(opposite.x, point.x);
  const minY = Math.min(opposite.y, point.y);
  const maxY = Math.max(opposite.y, point.y);
  return rectangularCorners(minX, minY, maxX, maxY);
}

function rectangularCorners(minX: number, minY: number, maxX: number, maxY: number): GridCorners {
  let left = clamp(minX, 0, 1);
  let top = clamp(minY, 0, 1);
  let right = clamp(maxX, 0, 1);
  let bottom = clamp(maxY, 0, 1);
  if (right - left < 0.005) {
    if (left > 0.995) left = 0.995;
    else right = left + 0.005;
  }
  if (bottom - top < 0.005) {
    if (top > 0.995) top = 0.995;
    else bottom = top + 0.005;
  }
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
