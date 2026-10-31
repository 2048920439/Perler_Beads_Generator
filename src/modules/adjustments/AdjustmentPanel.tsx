import type { EditorText } from '@/config/localization';
import type { AdjustmentSettings, LayerEffect } from './colorOperations';
import type { BeadLayer } from '@/common/types';
import { hasAdjustments } from './colorOperations';

type Props = {
  text: EditorText;
  activeLayer: BeadLayer;
  activeLayerName: string;
  adjustments: AdjustmentSettings;
  colorCleanupStrength: number;
  layerColorLimit: number;
  onAdjustmentChange: (key: keyof AdjustmentSettings, value: number) => void;
  onReset: () => void;
  onApplyEffect: (effect: LayerEffect, label: string) => void;
  onColorCleanupStrengthChange: (value: number) => void;
  onApplyColorCleanup: () => void;
  onLayerColorLimitChange: (value: number) => void;
  onApplyLayerColorLimit: () => void;
};

export function AdjustmentPanel({
  text,
  activeLayer,
  activeLayerName,
  adjustments,
  colorCleanupStrength,
  layerColorLimit,
  onAdjustmentChange,
  onReset,
  onApplyEffect,
  onColorCleanupStrengthChange,
  onApplyColorCleanup,
  onLayerColorLimitChange,
  onApplyLayerColorLimit,
}: Props) {
  return (
    <section className="panel-section panel-tab-body adjustment-section">
      <div className="adjustment-header">
        <h2>{text.adjustmentTitle}</h2>
        <span>{activeLayerName}</span>
      </div>
      <div className="adjustment-help">{text.adjustmentHint}</div>
      {([
        ['brightness', text.brightness, -50, 50, '%'],
        ['contrast', text.contrast, -50, 50, '%'],
        ['saturation', text.saturation, -50, 50, '%'],
        ['temperature', text.temperature, -50, 50, '%'],
        ['hue', text.hue, -180, 180, 'deg'],
      ] as const).map(([key, label, min, max, unit]) => (
        <label className="adjustment-range" key={key}>
          <span>
            <span>{label}</span>
            <strong>{adjustments[key]}{unit}</strong>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={key === 'hue' ? 5 : 1}
            value={adjustments[key]}
            onChange={(event) => onAdjustmentChange(key, Number(event.target.value))}
          />
        </label>
      ))}
      <div className="adjustment-actions">
        <button type="button" onClick={onReset} disabled={!hasAdjustments(adjustments)}>
          {text.resetAdjustments}
        </button>
      </div>
      <div className="adjustment-effect-card">
        <strong>{text.effects}</strong>
        <div className="adjustment-effect-grid">
          <button type="button" onClick={() => onApplyEffect('invert', text.invertEffect)} disabled={activeLayer.locked}>
            {text.invertEffect}
          </button>
          <button type="button" onClick={() => onApplyEffect('grayscale', text.grayscaleEffect)} disabled={activeLayer.locked}>
            {text.grayscaleEffect}
          </button>
          <button type="button" onClick={() => onApplyEffect('blackWhite', text.blackWhiteEffect)} disabled={activeLayer.locked}>
            {text.blackWhiteEffect}
          </button>
        </div>
      </div>
      <div className="adjustment-tool-card">
        <div className="adjustment-tool-heading">
          <strong>{text.colorCleanup}</strong>
          <b>{colorCleanupStrength}</b>
        </div>
        <span>{text.colorCleanupHint}</span>
        <input
          aria-label="Color cleanup strength"
          type="range"
          min={1}
          max={4}
          step={1}
          value={colorCleanupStrength}
          onChange={(event) => onColorCleanupStrengthChange(Number(event.target.value))}
        />
        <button type="button" onClick={onApplyColorCleanup} disabled={activeLayer.locked}>
          {text.applyColorCleanup}
        </button>
      </div>
      <div className="adjustment-tool-card">
        <div className="adjustment-tool-heading">
          <strong>{text.colorLimit}</strong>
          <b>{layerColorLimit}</b>
        </div>
        <span>{text.colorLimitHint}</span>
        <input
          aria-label="Layer color limit"
          type="range"
          min={2}
          max={48}
          step={1}
          value={layerColorLimit}
          onChange={(event) => onLayerColorLimitChange(Number(event.target.value))}
        />
        <button type="button" onClick={onApplyLayerColorLimit} disabled={activeLayer.locked}>
          {text.applyColorLimit}
        </button>
      </div>
    </section>
  );
}
