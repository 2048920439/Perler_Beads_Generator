import type { AdjustmentSettings, LayerEffect } from './colorOperations';
import { hasAdjustments } from './colorOperations';
import { useObservableState, useService } from '@/service-core';
import { AdjustmentService } from '@/services/adjustment-service';
import { LocalizationService } from '@/services/localization-service';
import { ProjectService } from '@/services/project-service';
import { layerDisplayName } from '@/features/layers/layerLabels';

export function AdjustmentPanel() {
  const service = useService(AdjustmentService);
  const projectService = useService(ProjectService);
  const localization = useService(LocalizationService);
  const language = useObservableState(localization.snapshot$);
  const text = localization.text;
  const { project } = useObservableState(projectService.snapshot$);
  const activeLayer = projectService.activeLayer;
  const activeLayerName = layerDisplayName(activeLayer, project.layers.findIndex((layer) => layer.id === activeLayer.id), language);
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
