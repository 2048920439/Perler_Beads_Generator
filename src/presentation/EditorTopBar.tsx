import { useEffect, useMemo, useRef, useState } from 'react';
import { sizePresets } from '@/config/editor';
import { GitHubIcon, PlusIcon, RedoIcon, TrashIcon, UndoIcon } from '@/common/ui/EditorIcons';
import { PrintExportMenu } from '@/modules/export/PrintExportMenu';
import type { PrintExportOptions } from '@/core/export/exporters';
import { summarizeUsage } from '@/core/usage';
import { useObservableState, useService } from '@/service-core';
import { ExportService } from '@/services/export-service';
import { ImageImportService } from '@/services/image-import-service';
import { LocalizationService } from '@/services/localization-service';
import { NoticeService } from '@/services/notice-service';
import { ProjectService } from '@/services/project-service';
import { WorkspaceService } from '@/services/workspace-service';

export function EditorTopBar() {
  const projectService = useService(ProjectService);
  const workspace = useService(WorkspaceService);
  const exports = useService(ExportService);
  const images = useService(ImageImportService);
  const localization = useService(LocalizationService);
  const notice = useService(NoticeService);
  const language = useObservableState(localization.snapshot$);
  const text = localization.text;
  const { project, past, future } = useObservableState(projectService.snapshot$);
  const [width, onWidthChange] = useState(project.width);
  const [height, onHeightChange] = useState(project.height);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const usage = useMemo(() => summarizeUsage(project), [project]);
  const usageCount = usage.length;
  const totalBeads = usage.reduce((sum, row) => sum + row.count, 0);
  const projectWidth = project.width;
  const projectHeight = project.height;
  const pastCount = past.length;
  const futureCount = future.length;
  const selectedSizePreset = sizePresets.find((preset) => preset.width === width && preset.height === height)?.label ?? '';
  const defaultProjectName = useMemo(() => exports.defaultProjectName(language), [exports, language]);
  useEffect(() => { onWidthChange(project.width); onHeightChange(project.height); }, [project.width, project.height]);
  const onLanguageChange = (nextLanguage: typeof language) => localization.setLanguage(nextLanguage);
  const onPresetChange = (value: string) => {
    const preset = sizePresets.find((item) => item.label === value);
    if (preset) { onWidthChange(preset.width); onHeightChange(preset.height); }
  };
  const onResize = () => workspace.resizeCanvas(width, height);
  const onExportPrint = (options: PrintExportOptions) => exports.exportPrint(options);
  const onExportUsage = () => exports.exportUsage();
  const onExportRecord = () => exports.exportProject();
  const onImportRecord = () => jsonInputRef.current?.click();
  const onNew = () => workspace.startBlank();
  const onClear = () => workspace.clearCanvas();
  const onUndo = () => projectService.undo();
  const onRedo = () => projectService.redo();
  return (
    <>
      <input
        ref={jsonInputRef}
        className="hidden-input"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void images.importRecord(file).catch((error: unknown) => notice.show(error instanceof Error ? error.message : text.invalidRecord));
          event.currentTarget.value = '';
        }}
      />
      <header className="topbar">
        <div className="brand-lockup" aria-label="Perler Beads Generator">
          <span className="logo-mark" aria-hidden="true"><span /><span /><span /><span /></span>
          <div>
            <strong>{text.appName}</strong>
            <small>{text.status(projectWidth, projectHeight, totalBeads, usageCount)}</small>
          </div>
        </div>

        <div className="topbar-workspace">
          <div className="topbar-params canvas-params" aria-label="Canvas controls">
            <span className="topbar-control-label">{text.board}</span>
            <div className="topbar-dimension-group">
              <input aria-label="Canvas width" type="number" min={8} max={180} value={width} onChange={(event) => onWidthChange(Number(event.target.value))} />
              <span className="size-times">×</span>
              <input aria-label="Canvas height" type="number" min={8} max={180} value={height} onChange={(event) => onHeightChange(Number(event.target.value))} />
            </div>
            <select className="canvas-preset-select" aria-label="Canvas preset" value={selectedSizePreset || ''} onChange={(event) => onPresetChange(event.target.value)}>
              <option value="" disabled hidden>{text.commonSizes}</option>
              {sizePresets.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}
            </select>
            <button className="canvas-apply-button" onClick={onResize}>{text.apply}</button>
          </div>
          <div className="topbar-command-zone">
            <div className="topbar-actions export-actions">
              <PrintExportMenu text={text} defaultProjectName={defaultProjectName} onExport={onExportPrint} />
              <button className="export-action-button" title={text.exportUsageTitle} onClick={onExportUsage}>{text.exportUsageFull}</button>
              <button className="export-action-button" title={text.exportRecordTitle} onClick={onExportRecord}>{text.exportRecordFull}</button>
              <button className="export-action-button" title={text.importRecordTitle} onClick={onImportRecord}>{text.importRecordFull}</button>
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <a className="github-link" href="https://github.com/Jett-Wu/Perler_Beads_Generator" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub">
            <GitHubIcon />
            <span>GitHub</span>
          </a>
          <div className="language-toggle" aria-label={text.language}>
            <button className={language === 'zh' ? 'active' : ''} onClick={() => onLanguageChange('zh')}>中</button>
            <button className={language === 'en' ? 'active' : ''} onClick={() => onLanguageChange('en')}>EN</button>
          </div>
        </div>
      </header>

      <div className="project-toolbar" role="toolbar" aria-label={language === 'zh' ? '编辑操作' : 'Edit actions'}>
        <div className="project-actions">
          <button className="project-action-button primary-action" onClick={onNew}><PlusIcon /><span>{text.new}</span></button>
          <button className="project-action-button" onClick={onClear}><TrashIcon /><span>{text.clear}</span></button>
          <span className="project-action-divider" aria-hidden="true" />
          <button className="project-action-button history-action" onClick={onUndo} disabled={pastCount === 0} title={`${text.undo} (Ctrl+Z / Meta+Z)`} aria-keyshortcuts="Control+Z Meta+Z"><UndoIcon /><span>{text.undo}</span></button>
          <button className="project-action-button history-action" onClick={onRedo} disabled={futureCount === 0} title={`${text.redo} (Ctrl+Shift+Z / Meta+Shift+Z / Ctrl+Y)`} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"><RedoIcon /><span>{text.redo}</span></button>
        </div>
      </div>
    </>
  );
}
