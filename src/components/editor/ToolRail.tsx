import { tools } from '@/config/editor';
import { ArrowOptionIcon, ResetIcon, ShapeOptionIcon, ToolIcon } from '@/common/ui/EditorIcons';
import type { CopyMode, MoveMode, RemoveMode, RightClickAction, ShapeFillMode, ShapeKind, TextDirection, ToolId, ArrowKind, MirrorDirection } from '@/common/types';
import { ClipboardPreview } from '@/components/editor/ClipboardPreview';
import { useObservableState, useService } from '@/service-core';
import { ProjectService } from '@/services/project-service';
import { ToolService } from '@/services/tool-service';
import { LocalizationService } from '@/services/localization-service';

export function ToolRail() {
  const localization = useService(LocalizationService);
  const language = useObservableState(localization.snapshot$);
  const projectService = useService(ProjectService);
  const { project } = useObservableState(projectService.snapshot$);
  const toolService = useService(ToolService);
  const toolState = useObservableState(toolService.snapshot$);
  const {
    tool, eraserSize, removeMode, moveMode, mirrorMode, mirrorDirection, shapeKind, shapeFillMode, arrowKind,
    textToolValue, textToolDirection, textToolSize, textToolSpacing, showPencilOptions, showEraserOptions,
    showRemoveOptions, showMoveOptions, showMirrorOptions, showShapeOptions, showTextOptions,
    showClipboardOptions, showPanOptions, clipboardPattern, copyMode, copySelectionIndices,
  } = toolState;
  const activateTool = (nextTool: ToolId) => toolService.activateTool(nextTool);
  const setShowPencilOptions = (value: boolean) => toolService.setOptionVisible('showPencilOptions', value);
  const setShowEraserOptions = (value: boolean) => toolService.setOptionVisible('showEraserOptions', value);
  const setShowRemoveOptions = (value: boolean) => toolService.setOptionVisible('showRemoveOptions', value);
  const setShowMoveOptions = (value: boolean) => toolService.setOptionVisible('showMoveOptions', value);
  const setShowMirrorOptions = (value: boolean) => toolService.setOptionVisible('showMirrorOptions', value);
  const setShowShapeOptions = (value: boolean) => toolService.setOptionVisible('showShapeOptions', value);
  const setShowClipboardOptions = (value: boolean) => toolService.setOptionVisible('showClipboardOptions', value);
  const setShowPanOptions = (value: boolean) => toolService.setOptionVisible('showPanOptions', value);
  const setShowTextOptions = (value: boolean) => toolService.setOptionVisible('showTextOptions', value);
  const setEraserSize = (value: number) => toolService.setEraserSize(value);
  const setRemoveMode = (value: RemoveMode) => toolService.setRemoveMode(value);
  const setMoveMode = (value: MoveMode) => toolService.setMoveMode(value);
  const setCopyMode = (value: CopyMode) => toolService.setCopyMode(value);
  const setCopySelectionIndices = (value: number[]) => toolService.setCopySelectionIndices(value);
  const setMirrorMode = (value: MoveMode) => toolService.setMirrorMode(value);
  const setMirrorDirection = (value: MirrorDirection) => toolService.setMirrorDirection(value);
  const setShapeFillMode = (value: ShapeFillMode) => toolService.setShapeFillMode(value);
  const setShapeKind = (value: ShapeKind) => toolService.setShapeKind(value);
  const setArrowKind = (value: ArrowKind) => toolService.setArrowKind(value);
  const setTextToolValue = (value: string) => toolService.setTextToolValue(value);
  const setTextToolDirection = (value: TextDirection) => toolService.setTextToolDirection(value);
  const setTextToolSize = (value: number) => toolService.setTextToolSize(value);
  const setTextToolSpacing = (value: number) => toolService.setTextToolSpacing(value);
  const shapeLabel = {
    line: localization.text.shapeLine,
    rectangle: localization.text.shapeRectangle,
    square: localization.text.shapeSquare,
    ellipse: localization.text.shapeEllipse,
    circle: localization.text.shapeCircle,
    triangle: localization.text.shapeTriangle,
    arrow: localization.text.shapeArrow,
  } satisfies Record<ShapeKind, string>;
  const arrowLabel = {
    single: localization.text.arrowSingle,
    double: localization.text.arrowDouble,
    block: localization.text.arrowBlock,
  } satisfies Record<ArrowKind, string>;
  return (
      <aside className="tool-rail">
        {tools.map((item) => (
          <button
            key={item.id}
            className={tool === item.id ? 'tool-button active' : 'tool-button'}
            aria-label={localization.text.tools[item.id].title}
            title={`${localization.text.tools[item.id].title} (${item.shortcut}) — ${localization.text.tools[item.id].hint}`}
            aria-keyshortcuts={item.shortcut.toLowerCase()}
            aria-pressed={tool === item.id}
            type="button"
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse') return;
              event.preventDefault();
              activateTool(item.id);
            }}
            onClick={() => activateTool(item.id)}
          >
            <ToolIcon tool={item.id} />
            <span>{localization.text.tools[item.id].title}</span>
          </button>
        ))}
        {tool === 'pencil' && showPencilOptions && (
          <div className="tool-options pencil-options" onMouseLeave={() => setShowPencilOptions(false)}>
            <div className="right-click-toggle compact" aria-label={localization.text.rightClick}>
              <span className="field-label-with-help">
                {localization.text.rightClick}
                <span className="help-dot mini" data-tooltip={localization.text.rightClickHint} aria-label={localization.text.rightClickHint} tabIndex={0}>?</span>
              </span>
              <div>
                {(['pan', 'erase'] as RightClickAction[]).map((action) => (
                  <button
                    key={action}
                    className={project.settings.rightClickAction === action ? 'active' : ''}
                    type="button"
                    aria-pressed={project.settings.rightClickAction === action}
                    onClick={() => projectService.updateSettings({ rightClickAction: action })}
                  >
                    {action === 'pan' ? localization.text.pan : localization.text.erase}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tool === 'eraser' && showEraserOptions && (
          <div className="tool-options eraser-options" onMouseLeave={() => setShowEraserOptions(false)}>
            <div className="tool-options-header">
              <span>{localization.text.eraserSize}</span>
              <strong>{localization.text.brushCells(eraserSize)}</strong>
            </div>
            <div className="brush-preview" aria-hidden="true">
              {eraserSize > 0 ? (
                <span style={{ width: `${10 + eraserSize * 3}px`, height: `${10 + eraserSize * 3}px` }} />
              ) : (
                <span className="brush-preview-dot" />
              )}
            </div>
            <input
              aria-label={localization.text.eraserSize}
              type="range"
              min={0}
              max={9}
              step={0.5}
              value={eraserSize}
              onChange={(event) => setEraserSize(Number(event.target.value))}
            />
          </div>
        )}
        {tool === 'remove' && showRemoveOptions && (
          <div className="tool-options remove-options" onMouseLeave={() => setShowRemoveOptions(false)}>
            <div className="right-click-toggle compact remove-scope-toggle" aria-label={localization.text.removeScope}>
              <span>{localization.text.removeScope}</span>
              <div>
                {(['same-connected', 'all-same-color', 'connected'] as RemoveMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={removeMode === mode ? 'active' : ''}
                    type="button"
                    aria-pressed={removeMode === mode}
                    onClick={() => setRemoveMode(mode)}
                  >
                    {mode === 'same-connected'
                      ? localization.text.removeSameConnected
                      : mode === 'all-same-color'
                        ? localization.text.removeAllSameColor
                        : localization.text.removeConnected}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tool === 'move' && showMoveOptions && (
          <div className="tool-options move-options" onMouseLeave={() => setShowMoveOptions(false)}>
            <div className="right-click-toggle compact" aria-label={localization.text.moveScope}>
              <span>{localization.text.moveScope}</span>
              <div>
                {(['layer', 'partial'] as MoveMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={moveMode === mode ? 'active' : ''}
                    type="button"
                    aria-pressed={moveMode === mode}
                    onClick={() => setMoveMode(mode)}
                  >
                    {mode === 'layer' ? localization.text.moveLayer : localization.text.movePartial}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {(tool === 'copy' || tool === 'paste') && showClipboardOptions && (
          <div
            className={`tool-options clipboard-options ${tool === 'copy' ? 'copy-options' : 'paste-options'}`}
            onMouseLeave={() => setShowClipboardOptions(false)}
          >
            {tool === 'copy' && (
              <div className="right-click-toggle compact clipboard-mode-toggle" aria-label={localization.text.copyScope}>
                <span>{localization.text.copyScope}</span>
                <div>
                  {(['connected', 'selection'] as CopyMode[]).map((mode) => (
                    <button
                      key={mode}
                      className={copyMode === mode ? 'active' : ''}
                      type="button"
                      aria-pressed={copyMode === mode}
                      onClick={() => {
                        setCopyMode(mode);
                        setCopySelectionIndices([]);
                      }}
                    >
                      {mode === 'connected' ? localization.text.copyConnected : localization.text.copySelection}
                    </button>
                  ))}
                </div>
                {copyMode === 'selection' && <p className="tool-hint compact-hint">{localization.text.copySelectionHint}</p>}
              </div>
            )}
            <div className="clipboard-tool-header">
              <div>
                <strong>{localization.text.clipboardPreview}</strong>
                {clipboardPattern && (
                  <span>{localization.text.clipboardSize(clipboardPattern.width, clipboardPattern.height, toolService.getClipboardBeadCount())}</span>
                )}
              </div>
              <button
                className="clipboard-reset-button"
                type="button"
                aria-label={localization.text.resetClipboard}
                title={localization.text.resetClipboard}
                disabled={!clipboardPattern && copySelectionIndices.length === 0}
                onClick={() => toolService.resetClipboard()}
              >
                <ResetIcon />
              </button>
            </div>
            {clipboardPattern ? (
              <ClipboardPreview pattern={clipboardPattern} />
            ) : (
              <div className="clipboard-empty">{localization.text.clipboardEmpty}</div>
            )}
          </div>
        )}
        {tool === 'mirror' && showMirrorOptions && (
          <div className="tool-options mirror-options" onMouseLeave={() => setShowMirrorOptions(false)}>
            <div className="right-click-toggle compact" aria-label={localization.text.moveScope}>
              <span>{localization.text.moveScope}</span>
              <div>
                {(['layer', 'partial'] as MoveMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={mirrorMode === mode ? 'active' : ''}
                    type="button"
                    aria-pressed={mirrorMode === mode}
                    onClick={() => setMirrorMode(mode)}
                  >
                    {mode === 'layer' ? localization.text.moveLayer : localization.text.movePartial}
                  </button>
                ))}
              </div>
            </div>
            <div className="right-click-toggle compact" aria-label={localization.text.mirrorDirection}>
              <span>{localization.text.mirrorDirection}</span>
              <div>
                {(['horizontal', 'vertical'] as MirrorDirection[]).map((direction) => (
                  <button
                    key={direction}
                    className={mirrorDirection === direction ? 'active' : ''}
                    type="button"
                    aria-pressed={mirrorDirection === direction}
                    onClick={() => setMirrorDirection(direction)}
                  >
                    {direction === 'horizontal' ? localization.text.mirrorHorizontal : localization.text.mirrorVertical}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tool === 'shape' && showShapeOptions && (
          <div className="tool-options shape-options" onMouseLeave={() => setShowShapeOptions(false)}>
            <div className="right-click-toggle compact" aria-label={localization.text.shapeStyle}>
              <span>{localization.text.shapeStyle}</span>
              <div>
                {(['outline', 'filled'] as ShapeFillMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={shapeFillMode === mode ? 'active' : ''}
                    type="button"
                    aria-pressed={shapeFillMode === mode}
                    disabled={shapeKind === 'line' || shapeKind === 'arrow'}
                    onClick={() => setShapeFillMode(mode)}
                  >
                    {mode === 'outline' ? localization.text.shapeOutline : localization.text.shapeFilled}
                  </button>
                ))}
              </div>
            </div>
            <div className="shape-picker" aria-label={localization.text.shapeType}>
              <span>{localization.text.shapeType}</span>
              <div>
                {(['line', 'rectangle', 'square', 'ellipse', 'circle', 'triangle', 'arrow'] as ShapeKind[]).map((kind) => (
                  <button
                    key={kind}
                    className={shapeKind === kind ? 'active' : ''}
                    type="button"
                    aria-pressed={shapeKind === kind}
                    onClick={() => setShapeKind(kind)}
                  >
                    <ShapeOptionIcon shape={kind} />
                    <span>{shapeLabel[kind]}</span>
                  </button>
                ))}
              </div>
            </div>
            {shapeKind === 'arrow' && (
              <div className="shape-picker arrow-picker" aria-label={localization.text.arrowStyle}>
                <span>{localization.text.arrowStyle}</span>
                <div>
                  {(['single', 'double', 'block'] as ArrowKind[]).map((kind) => (
                    <button
                      key={kind}
                      className={arrowKind === kind ? 'active' : ''}
                      type="button"
                      aria-pressed={arrowKind === kind}
                      onClick={() => setArrowKind(kind)}
                    >
                      <ArrowOptionIcon arrow={kind} />
                      <span>{arrowLabel[kind]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {tool === 'text' && showTextOptions && (
          <div className="tool-options text-options">
            <label className="text-tool-field">
              <span className="text-field-title">
                {localization.text.textContent}
                <button
                  className="tool-options-close"
                  type="button"
                  aria-label={localization.text.close}
                  title={localization.text.close}
                  onClick={() => setShowTextOptions(false)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7l10 10" />
                    <path d="M17 7L7 17" />
                  </svg>
                </button>
              </span>
              <input
                type="text"
                maxLength={32}
                value={textToolValue}
                placeholder={localization.text.textPlaceholder}
                onChange={(event) => setTextToolValue(event.target.value)}
              />
            </label>
            <div className="right-click-toggle compact" aria-label={localization.text.textDirection}>
              <span>{localization.text.textDirection}</span>
              <div>
                {(['horizontal', 'vertical'] as TextDirection[]).map((direction) => (
                  <button
                    key={direction}
                    className={textToolDirection === direction ? 'active' : ''}
                    type="button"
                    aria-pressed={textToolDirection === direction}
                    onClick={() => setTextToolDirection(direction)}
                  >
                    {direction === 'horizontal' ? localization.text.textHorizontal : localization.text.textVertical}
                  </button>
                ))}
              </div>
            </div>
            <div className="tool-options-header">
              <span>{localization.text.textSize}</span>
              <label className="tool-number-field" aria-label={localization.text.textSize}>
                <input
                  type="number"
                  min={5}
                  max={72}
                  step={1}
                  value={textToolSize}
                  onChange={(event) => setTextToolSize(toolService.normalizeTextSize(Number(event.target.value)))}
                />
                <span>{language === 'zh' ? '格' : 'cells'}</span>
              </label>
            </div>
            <input
              aria-label={localization.text.textSize}
              type="range"
              min={5}
              max={72}
              step={1}
              value={textToolSize}
              onChange={(event) => setTextToolSize(Number(event.target.value))}
            />
            <div className="tool-options-header">
              <span>{localization.text.textSpacing}</span>
              <label className="tool-number-field" aria-label={localization.text.textSpacing}>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={1}
                  value={textToolSpacing}
                  onChange={(event) => setTextToolSpacing(toolService.normalizeTextSpacing(Number(event.target.value)))}
                />
                <span>{language === 'zh' ? '格' : 'cells'}</span>
              </label>
            </div>
            <input
              aria-label={localization.text.textSpacing}
              type="range"
              min={0}
              max={24}
              step={1}
              value={textToolSpacing}
              onChange={(event) => setTextToolSpacing(Number(event.target.value))}
            />
          </div>
        )}
        {tool === 'pan' && showPanOptions && (
          <div className="tool-options pan-options" onMouseLeave={() => setShowPanOptions(false)}>
            <div className="tool-options-header">
              <strong>{localization.text.tools.pan.title}</strong>
            </div>
            <p className="tool-hint">{localization.text.panToolHint}</p>
          </div>
        )}
      </aside>
  );
}
