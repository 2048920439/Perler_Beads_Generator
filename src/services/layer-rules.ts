import type { BeadLayer } from '@/common/types';
import type { Language } from '@/config/localization';

export function layerDisplayName(layer: BeadLayer, index: number, language: Language): string {
  if (layer.customName) return layer.name;
  const match = layer.name.match(/^(?:Layer|图层)\s+(\d+)$/);
  const prefix = language === 'zh' ? '图层' : 'Layer';
  if (match) return `${prefix} ${match[1]}`;
  if (layer.id === 'base' || ['Pattern', 'Base bead layer', '基础珠子层'].includes(layer.name) || !layer.name.trim()) {
    return `${prefix} ${index + 1}`;
  }
  return layer.name;
}
