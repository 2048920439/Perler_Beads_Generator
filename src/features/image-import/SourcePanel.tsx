import * as React from 'react';
import ThreePreview from '../../ThreePreview';
import type { BeadProject, BackgroundMode, GenerationStyle } from '../../types';
import type { EditorText, Language } from '../editor/localization';

type Props = {
  text: EditorText;
  language: Language;
  totalBeads: number;
  displayProject: BeadProject;
  pendingFile: File | null;
  pendingImageUrl: string | null;
  isGenerating: boolean;
  convertWidth: number;
  maxColors: number;
  tolerance: number;
  generationStyle: GenerationStyle;
  backgroundMode: BackgroundMode;
  referenceFile: File | null;
  referenceImageUrl: string | null;
  referenceVisible: boolean;
  referenceOpacity: number;
  referenceAdjusting: boolean;
  referencePlacement: 'below' | 'above';
  imageHelpProps: (tooltip: string) => React.HTMLAttributes<HTMLElement> & { 'data-tooltip': string };
  onChooseImage: () => void;
  onChooseReference: () => void;
  onConvertWidthChange: (value: number) => void;
  onMaxColorsChange: (value: number) => void;
  onToleranceChange: (value: number) => void;
  onGenerationStyleChange: (value: GenerationStyle) => void;
  onBackgroundModeChange: (value: BackgroundMode) => void;
  onReferenceVisibleChange: (value: boolean) => void;
  onReferenceOpacityChange: (value: number) => void;
  onReferenceAdjustingChange: (value: boolean) => void;
  onReferencePlacementChange: (value: 'below' | 'above') => void;
  onResetReferenceTransform: () => void;
};

export function SourcePanel({
  text,
  language,
  totalBeads,
  displayProject,
  pendingFile,
  pendingImageUrl,
  isGenerating,
  convertWidth,
  maxColors,
  tolerance,
  generationStyle,
  backgroundMode,
  referenceFile,
  referenceImageUrl,
  referenceVisible,
  referenceOpacity,
  referenceAdjusting,
  referencePlacement,
  imageHelpProps,
  onChooseImage,
  onChooseReference,
  onConvertWidthChange,
  onMaxColorsChange,
  onToleranceChange,
  onGenerationStyleChange,
  onBackgroundModeChange,
  onReferenceVisibleChange,
  onReferenceOpacityChange,
  onReferenceAdjustingChange,
  onReferencePlacementChange,
  onResetReferenceTransform,
}: Props) {
  return (
    <aside className="left-panel">
      <section className="left-card preview-card">
        <div className="left-card-header">
          <div>
            <strong>{text.preview3d}</strong>
            <span>{text.liveBoard}</span>
          </div>
          <small>{totalBeads} {language === 'zh' ? '颗' : 'beads'}</small>
        </div>
        <ThreePreview
          project={displayProject}
          title={text.preview3d}
          emptyLabel={text.previewEmpty}
          closeLabel={text.close}
          expandLabel={text.expandPreview}
        />
      </section>

      <section className="left-card image-card">
        <div className="left-card-header">
          <div>
            <strong className="field-label-with-help">
              {text.imageToPattern}
              <span className="help-dot image-help-dot" {...imageHelpProps(text.autoGenerateHint)}>?</span>
            </strong>
          </div>
          <small>{pendingFile ? text.ready : text.noImage}</small>
        </div>

        <button className={pendingImageUrl ? `upload-zone has-image${isGenerating ? ' is-generating' : ''}` : `upload-zone${isGenerating ? ' is-generating' : ''}`} onClick={onChooseImage}>
          {pendingImageUrl && <img src={pendingImageUrl} alt="" />}
          <span className="upload-zone-text">
            <strong>{isGenerating ? text.preparingPattern : pendingFile ? pendingFile.name : text.uploadImage}</strong>
            <span>{isGenerating ? pendingFile?.name : pendingFile ? 'PNG / JPG / WebP' : 'PNG, JPG, WebP'}</span>
          </span>
        </button>

        <div className="image-field-grid">
          <label className="image-number-field">
            <span className="field-label-with-help">
              {text.width}
              <span className="help-dot image-help-dot" {...imageHelpProps(text.heightFromRatio)}>?</span>
            </span>
            <input aria-label="Output width" type="number" min={8} max={180} value={convertWidth} onChange={(event) => onConvertWidthChange(Number(event.target.value))} />
          </label>
          <label className="image-range-field">
            <span>
              <span className="field-label-with-help">
                {text.colors}
                <span className="help-dot image-help-dot" {...imageHelpProps(text.colorsHint)}>?</span>
              </span>
              <strong>{maxColors}</strong>
            </span>
            <input aria-label="Color limit" type="range" min={6} max={48} step={1} value={maxColors} onChange={(event) => onMaxColorsChange(Number(event.target.value))} />
          </label>
          <label className="image-range-field">
            <span>
              <span className="field-label-with-help">
                {text.tolerance}
                <span className="help-dot image-help-dot" {...imageHelpProps(text.toleranceHint)}>?</span>
              </span>
              <strong>{tolerance}</strong>
            </span>
            <input aria-label="Background tolerance" type="range" min={0} max={120} step={1} value={tolerance} onChange={(event) => onToleranceChange(Number(event.target.value))} />
          </label>
        </div>

        <label className="stacked-field image-style-field">
          <span>{text.generationStyle}</span>
          <select
            aria-label="Generation style"
            value={generationStyle}
            onChange={(event) => onGenerationStyleChange(event.target.value as GenerationStyle)}
          >
            <option value="cartoon">{text.generationStyleCartoon}</option>
            <option value="realistic">{text.generationStyleRealistic}</option>
          </select>
        </label>

        <label className="stacked-field image-background-field">
          <span>{text.background}</span>
          <select aria-label="Background handling" value={backgroundMode} onChange={(event) => onBackgroundModeChange(event.target.value as BackgroundMode)}>
            <option value="keep">{text.keepBackground}</option>
            <option value="remove-white">{text.removeWhite}</option>
          </select>
        </label>
      </section>

      <section className="left-card reference-card">
        <div className="left-card-header">
          <div>
            <strong>{text.referenceImage}</strong>
            <span>{text.referenceHint} · {text.referenceShortcutHint}</span>
          </div>
          <small>{referenceImageUrl ? text.ready : text.noImage}</small>
        </div>

        <button className={referenceImageUrl ? 'upload-zone reference-upload-zone has-image' : 'upload-zone reference-upload-zone'} onClick={onChooseReference}>
          {referenceImageUrl && <img src={referenceImageUrl} alt="" />}
          <span className="upload-zone-text">
            <strong>{referenceFile ? referenceFile.name : text.uploadReferenceImage}</strong>
            <span>{referenceFile ? 'PNG / JPG / WebP' : 'PNG, JPG, WebP'}</span>
          </span>
        </button>

        <label className="switch-row reference-switch">
          <span>{text.showReferenceImage}</span>
          <input
            type="checkbox"
            checked={referenceVisible}
            disabled={!referenceImageUrl}
            aria-keyshortcuts="o"
            title={text.referenceShortcutHint}
            onChange={(event) => onReferenceVisibleChange(event.target.checked)}
          />
        </label>

        <label className="image-range-field reference-opacity-field">
          <span>
            <span>{text.referenceOpacity}</span>
            <strong>{Math.round((1 - referenceOpacity) * 100)}%</strong>
          </span>
          <input
            aria-label="Reference opacity"
            type="range"
            min={0.1}
            max={0.95}
            step={0.05}
            value={1 - referenceOpacity}
            disabled={!referenceImageUrl || !referenceVisible}
            onChange={(event) => onReferenceOpacityChange(1 - Number(event.target.value))}
          />
        </label>

        <div className="reference-adjust-row">
          <label className="switch-row reference-switch">
            <span>{text.referenceAdjust}</span>
            <input
              type="checkbox"
              checked={referenceAdjusting}
              disabled={!referenceImageUrl || !referenceVisible}
              onChange={(event) => onReferenceAdjustingChange(event.target.checked)}
            />
          </label>
          <button
            type="button"
            className="reference-reset-button"
            disabled={!referenceImageUrl}
            onClick={onResetReferenceTransform}
          >
            {text.resetReferenceTransform}
          </button>
        </div>

        <div className="reference-control-grid">
          <label className="stacked-field reference-placement-field">
            <span>{text.referencePlacement}</span>
            <div className="reference-placement-toggle" aria-label={text.referencePlacement}>
              <button
                type="button"
                className={referencePlacement === 'below' ? 'active' : ''}
                disabled={!referenceImageUrl}
                aria-pressed={referencePlacement === 'below'}
                onClick={() => onReferencePlacementChange('below')}
              >
                {text.referenceBelow}
              </button>
              <button
                type="button"
                className={referencePlacement === 'above' ? 'active' : ''}
                disabled={!referenceImageUrl}
                aria-pressed={referencePlacement === 'above'}
                onClick={() => onReferencePlacementChange('above')}
              >
                {text.referenceAbove}
              </button>
            </div>
          </label>
        </div>
      </section>
    </aside>
  );
}
