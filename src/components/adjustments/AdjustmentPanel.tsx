import type { AdjustmentSettings, LayerEffect } from '@/services/adjustment-operations';
import { useObservableState, useService } from '@/service-core';
import { AdjustmentService } from '@/services/adjustment-service';
import { LocalizationService } from '@/services/localization-service';
import { EditorService } from '@/services/editor-service';

export function AdjustmentPanel() {
  const service = useService(AdjustmentService);
  const localization = useService(LocalizationService);
  const editor = useService(EditorService);
  useObservableState(localization.snapshot$);
  const { activeLayer, activeLayerName } = useObservableState(editor.snapshot$);
  const { adjustments, colorCleanupStrength, layerColorLimit } = useObservableState(service.snapshot$);
  const onAdjustmentChange = (key: keyof AdjustmentSettings, value: number) => service.setAdjustment(key, value);
  const onReset = () => service.reset();
  const onApplyEffect = (effect: LayerEffect, label: string) => service.applyEffect(effect, label);
  const onColorCleanupStrengthChange = (value: number) => service.setColorCleanupStrength(value);
  const onApplyColorCleanup = () => service.cleanup();
  const onLayerColorLimitChange = (value: number) => service.setLayerColorLimit(value);
  const onApplyLayerColorLimit = () => service.limitColors();
  return (
    <section className="panel-section panel-tab-body adjustment-section">
      <div className="adjustment-header">
        <h2>{localization.text.adjustmentTitle}</h2>
        <span>{activeLayerName}</span>
      </div>
      <div className="adjustment-help">{localization.text.adjustmentHint}</div>
      {([
        ['brightness', localization.text.brightness, -50, 50, '%'],
        ['contrast', localization.text.contrast, -50, 50, '%'],
        ['saturation', localization.text.saturation, -50, 50, '%'],
        ['temperature', localization.text.temperature, -50, 50, '%'],
        ['hue', localization.text.hue, -180, 180, 'deg'],
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
        <button type="button" onClick={onReset} disabled={!service.hasAdjustments(adjustments)}>
          {localization.text.resetAdjustments}
        </button>
      </div>
      <div className="adjustment-effect-card">
        <strong>{localization.text.effects}</strong>
        <div className="adjustment-effect-grid">
          <button type="button" onClick={() => onApplyEffect('invert', localization.text.invertEffect)} disabled={activeLayer.locked}>
            {localization.text.invertEffect}
          </button>
          <button type="button" onClick={() => onApplyEffect('grayscale', localization.text.grayscaleEffect)} disabled={activeLayer.locked}>
            {localization.text.grayscaleEffect}
          </button>
          <button type="button" onClick={() => onApplyEffect('blackWhite', localization.text.blackWhiteEffect)} disabled={activeLayer.locked}>
            {localization.text.blackWhiteEffect}
          </button>
        </div>
      </div>
      <div className="adjustment-tool-card">
        <div className="adjustment-tool-heading">
          <strong>{localization.text.colorCleanup}</strong>
          <b>{colorCleanupStrength}</b>
        </div>
        <span>{localization.text.colorCleanupHint}</span>
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
          {localization.text.applyColorCleanup}
        </button>
      </div>
      <div className="adjustment-tool-card">
        <div className="adjustment-tool-heading">
          <strong>{localization.text.colorLimit}</strong>
          <b>{layerColorLimit}</b>
        </div>
        <span>{localization.text.colorLimitHint}</span>
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
          {localization.text.applyColorLimit}
        </button>
      </div>
    </section>
  );
}
