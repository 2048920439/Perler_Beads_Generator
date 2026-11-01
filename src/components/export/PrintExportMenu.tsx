import * as React from 'react';
import { CloseIcon, ExportIcon } from '@/common/ui/EditorIcons';
import type { EditorText } from '@/config/localization';
import type { PrintExportOptions } from '@/services/export-service';

const { useEffect, useState } = React;

type PrintExportMenuProps = {
  text: EditorText;
  defaultProjectName: string;
  onExport: (options: PrintExportOptions) => void;
};

export function PrintExportMenu({ text, defaultProjectName, onExport }: PrintExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<PrintExportOptions>({
    format: 'png',
    exportBounds: 'pattern',
    showColorCodes: true,
    showGuideLines: true,
    projectName: '',
    authorName: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('.print-export-menu')) return;
      setIsOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen]);

  function updateOptions(changes: Partial<PrintExportOptions>) {
    setOptions((current) => ({ ...current, ...changes }));
  }

  return (
    <div className="print-export-menu">
      <button
        className="export-action-button primary-action print-export-button"
        title={`${text.exportPatternTitle} PNG`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <ExportIcon />
        <span>{text.exportPatternFull}</span>
      </button>
      {isOpen && (
        <div className="print-export-popover">
          <div className="print-export-popover-header">
            <strong>{text.printExportSettings}</strong>
            <button
              className="print-export-close"
              type="button"
              aria-label={text.close}
              title={text.close}
              onClick={() => setIsOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>
          <label className="export-text-field">
            <span>{text.exportFormat}</span>
            <select
              className="export-format-select"
              value={options.format ?? 'png'}
              onChange={(event) => updateOptions({ format: event.target.value as 'png' | 'pdf' })}
            >
              <option value="png">PNG</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <label className="export-text-field">
            <span>{text.exportBounds}</span>
            <select
              className="export-format-select"
              value={options.exportBounds ?? 'pattern'}
              onChange={(event) => updateOptions({ exportBounds: event.target.value as 'pattern' | 'canvas' })}
            >
              <option value="pattern">{text.exportPatternBounds}</option>
              <option value="canvas">{text.exportCanvasBounds}</option>
            </select>
          </label>
          <label className="export-text-field">
            <span>{text.projectNickname}</span>
            <input
              value={options.projectName ?? ''}
              placeholder={defaultProjectName}
              onChange={(event) => updateOptions({ projectName: event.target.value })}
            />
          </label>
          <label className="export-text-field">
            <span>{text.authorNickname}</span>
            <input
              value={options.authorName ?? ''}
              placeholder={text.optional}
              onChange={(event) => updateOptions({ authorName: event.target.value })}
            />
          </label>
          <label className="switch-row">
            <span>{text.showColorCodes}</span>
            <input
              type="checkbox"
              checked={options.showColorCodes}
              onChange={(event) => updateOptions({ showColorCodes: event.target.checked })}
            />
          </label>
          <label className="switch-row">
            <span>{text.showGuideLines}</span>
            <input
              type="checkbox"
              checked={options.showGuideLines}
              onChange={(event) => updateOptions({ showGuideLines: event.target.checked })}
            />
          </label>
          <button className="export-submit-button" onClick={() => {
            onExport(options);
            setIsOpen(false);
          }}>
            {text.exportNow} {(options.format ?? 'png').toUpperCase()}
          </button>
        </div>
      )}
    </div>
  );
}
