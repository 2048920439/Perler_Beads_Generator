import * as React from 'react';
import ThreePreview from '@/features/editor/ThreePreview';
import type { BackgroundMode, GenerationStyle } from '@/common/types';
import { getDisplayProject } from '@/core/project';
import { summarizeUsage } from '@/core/usage';
import { ImageGridEditor } from '@/features/image-import/ImageGridEditor';
import { useObservableState, useService } from '@/service-core';
import { ImageImportService } from '@/services/image-import-service';
import { LocalizationService } from '@/services/localization-service';
import { ProjectService } from '@/services/project-service';
import { ReferenceImageService } from '@/services/reference-image-service';

export function SourcePanel() {
  const images = useService(ImageImportService);
  const reference = useService(ReferenceImageService);
  const localization = useService(LocalizationService);
  const projectService = useService(ProjectService);
  const language = useObservableState(localization.snapshot$);
  const text = localization.text;
  const { project } = useObservableState(projectService.snapshot$);
  const { pendingFile, pendingImageUrl, isGenerating, convertWidth, maxColors, tolerance, generationStyle, backgroundMode, showGridEditor } = useObservableState(images.snapshot$);
  const { file: referenceFile, url: referenceImageUrl, visible: referenceVisible, opacity: referenceOpacity, adjusting: referenceAdjusting, placement: referencePlacement } = useObservableState(reference.snapshot$);
  const displayProject = React.useMemo(() => getDisplayProject(project), [project]);
  const totalBeads = React.useMemo(() => summarizeUsage(project).reduce((sum, row) => sum + row.count, 0), [project]);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const referenceInput = React.useRef<HTMLInputElement>(null);
  const [floatingHelp, setFloatingHelp] = React.useState<{ text: string; left: number; top: number } | null>(null);
  function imageHelpProps(tooltip: string) {
    function show(anchor: HTMLElement) {
      const rect = anchor.getBoundingClientRect();
      setFloatingHelp({ text: tooltip, left: Math.min(rect.right + 8, window.innerWidth - 182), top: rect.top + rect.height / 2 });
    }
    return {
      'data-tooltip': tooltip, 'aria-label': tooltip, tabIndex: 0,
      onMouseEnter: (event: React.MouseEvent<HTMLElement>) => show(event.currentTarget),
      onMouseLeave: () => setFloatingHelp(null),
      onFocus: (event: React.FocusEvent<HTMLElement>) => show(event.currentTarget),
      onBlur: () => setFloatingHelp(null),
    };
  }
  const onChooseImage = () => fileInput.current?.click();
  const onChooseReference = () => referenceInput.current?.click();
  const onConvertWidthChange = (value: number) => images.updateSettings({ convertWidth: value });
  const onMaxColorsChange = (value: number) => images.updateSettings({ maxColors: value });
  const onToleranceChange = (value: number) => images.updateSettings({ tolerance: value });
  const onGenerationStyleChange = (value: GenerationStyle) => images.updateSettings({ generationStyle: value });
  const onBackgroundModeChange = (value: BackgroundMode) => images.updateSettings({ backgroundMode: value });
  const onReferenceVisibleChange = (value: boolean) => reference.update({ visible: value });
  const onReferenceOpacityChange = (value: number) => reference.update({ opacity: value });
  const onReferenceAdjustingChange = (value: boolean) => reference.update({ adjusting: value });
  const onReferencePlacementChange = (value: 'below' | 'above') => reference.update({ placement: value });
  const onResetReferenceTransform = () => reference.resetTransform();
  return (
    <>
      <input ref={fileInput} className="hidden-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file) images.openImage(file);
        event.currentTarget.value = '';
      }} />
      <input ref={referenceInput} className="hidden-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file) reference.load(file);
        event.currentTarget.value = '';
      }} />
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
      {showGridEditor && pendingFile && (
        <ImageGridEditor
          file={pendingFile}
          initialWidth={convertWidth}
          language={language}
          onCancel={() => images.closeGridEditor()}
          onConfirm={(width, height, corners) => { void images.generate(width, height, corners); }}
        />
      )}
      {floatingHelp && (
        <div className="floating-help-tooltip" style={{ left: floatingHelp.left, top: floatingHelp.top }}>
          {floatingHelp.text}
        </div>
      )}
    </>
  );
}
