import { tools } from '@/config/editor';
import { ArrowOptionIcon, ResetIcon, ShapeOptionIcon, ToolIcon } from '@/common/ui/EditorIcons';
import type { CopyMode, MoveMode, RemoveMode, RightClickAction, ShapeFillMode, ShapeKind, TextDirection, ToolId, ArrowKind, MirrorDirection } from '@/common/types';
import { ClipboardPreview } from '@/features/editor/ClipboardPreview';
import { useObservableState, useService } from '@/service-core';
import { ProjectService } from '@/services/project-service';
import { ToolService } from '@/services/tool-service';
import { LocalizationService } from '@/services/localization-service';

export function ToolRail() {
  const localization = useService(LocalizationService);
  const language = useObservableState(localization.snapshot$);
  const text = localization.text;
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
  const rightClickAction = project.settings.rightClickAction;
  const shapeLabel = {
    line: text.shapeLine,
    rectangle: text.shapeRectangle,
    square: text.shapeSquare,
    ellipse: text.shapeEllipse,
    circle: text.shapeCircle,
    triangle: text.shapeTriangle,
    arrow: text.shapeArrow,
  } satisfies Record<ShapeKind, string>;
  const arrowLabel = {
    single: text.arrowSingle,
    double: text.arrowDouble,
    block: text.arrowBlock,
  } satisfies Record<ArrowKind, string>;
  return (
      <aside className="tool-rail">
        {tools.map((item) => (
          <button
            key={item.id}
            className={tool === item.id ? 'tool-button active' : 'tool-button'}
            aria-label={text.tools[item.id].title}
            title={`${text.tools[item.id].title} (${item.shortcut}) — ${text.tools[item.id].hint}`}
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
            <span>{text.tools[item.id].title}</span>
          </button>
        ))}
        {tool === 'pencil' && showPencilOptions && (
          <div className="tool-options pencil-options" onMouseLeave={() => setShowPencilOptions(false)}>
            <div className="right-click-toggle compact" aria-label={text.rightClick}>
              <span className="field-label-with-help">
                {text.rightClick}
                <span className="help-dot mini" data-tooltip={text.rightClickHint} aria-label={text.rightClickHint} tabIndex={0}>?</span>
              </span>
              <div>
                {(['pan', 'erase'] as RightClickAction[]).map((action) => (
                  <button
                    key={action}
                    className={rightClickAction === action ? 'active' : ''}
                    type="button"
                    aria-pressed={rightClickAction === action}
                    onClick={() => projectService.updateSettings({ rightClickAction: action })}
                  >
                    {action === 'pan' ? text.pan : text.erase}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tool === 'eraser' && showEraserOptions && (
          <div className="tool-options eraser-options" onMouseLeave={() => setShowEraserOptions(false)}>
            <div className="tool-options-header">
              <span>{text.eraserSize}</span>
              <strong>{text.brushCells(eraserSize)}</strong>
            </div>
            <div className="brush-preview" aria-hidden="true">
              {eraserSize > 0 ? (
                <span style={{ width: `${10 + eraserSize * 3}px`, height: `${10 + eraserSize * 3}px` }} />
              ) : (
                <span className="brush-preview-dot" />
              )}
            </div>
            <input
              aria-label={text.eraserSize}
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
            <div className="right-click-toggle compact remove-scope-toggle" aria-label={text.removeScope}>
              <span>{text.removeScope}</span>
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
                      ? text.removeSameConnected
                      : mode === 'all-same-color'
                        ? text.removeAllSameColor
                        : text.removeConnected}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tool === 'move' && showMoveOptions && (
          <div className="tool-options move-options" onMouseLeave={() => setShowMoveOptions(false)}>
            <div className="right-click-toggle compact" aria-label={text.moveScope}>
              <span>{text.moveScope}</span>
              <div>
                {(['layer', 'partial'] as MoveMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={moveMode === mode ? 'active' : ''}
                    type="button"
                    aria-pressed={moveMode === mode}
                    onClick={() => setMoveMode(mode)}
                  >
                    {mode === 'layer' ? text.moveLayer : text.movePartial}
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
              <div className="right-click-toggle compact clipboard-mode-toggle" aria-label={text.copyScope}>
                <span>{text.copyScope}</span>
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
                      {mode === 'connected' ? text.copyConnected : text.copySelection}
                    </button>
                  ))}
                </div>
                {copyMode === 'selection' && <p className="tool-hint compact-hint">{text.copySelectionHint}</p>}
              </div>
            )}
            <div className="clipboard-tool-header">
              <div>
                <strong>{text.clipboardPreview}</strong>
                {clipboardPattern && (
                  <span>{text.clipboardSize(clipboardPattern.width, clipboardPattern.height, clipboardPattern.cells.filter(Boolean).length)}</span>
                )}
              </div>
              <button
                className="clipboard-reset-button"
                type="button"
                aria-label={text.resetClipboard}
                title={text.resetClipboard}
                disabled={!clipboardPattern && copySelectionIndices.length === 0}
                onClick={() => toolService.resetClipboard()}
              >
                <ResetIcon />
              </button>
            </div>
            {clipboardPattern ? (
              <ClipboardPreview pattern={clipboardPattern} />
            ) : (
              <div className="clipboard-empty">{text.clipboardEmpty}</div>
            )}
          </div>
        )}
        {tool === 'mirror' && showMirrorOptions && (
          <div className="tool-options mirror-options" onMouseLeave={() => setShowMirrorOptions(false)}>
            <div className="right-click-toggle compact" aria-label={text.moveScope}>
              <span>{text.moveScope}</span>
              <div>
                {(['layer', 'partial'] as MoveMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={mirrorMode === mode ? 'active' : ''}
                    type="button"
                    aria-pressed={mirrorMode === mode}
                    onClick={() => setMirrorMode(mode)}
                  >
                    {mode === 'layer' ? text.moveLayer : text.movePartial}
                  </button>
                ))}
              </div>
            </div>
            <div className="right-click-toggle compact" aria-label={text.mirrorDirection}>
              <span>{text.mirrorDirection}</span>
              <div>
                {(['horizontal', 'vertical'] as MirrorDirection[]).map((direction) => (
                  <button
                    key={direction}
                    className={mirrorDirection === direction ? 'active' : ''}
                    type="button"
                    aria-pressed={mirrorDirection === direction}
                    onClick={() => setMirrorDirection(direction)}
                  >
                    {direction === 'horizontal' ? text.mirrorHorizontal : text.mirrorVertical}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tool === 'shape' && showShapeOptions && (
          <div className="tool-options shape-options" onMouseLeave={() => setShowShapeOptions(false)}>
            <div className="right-click-toggle compact" aria-label={text.shapeStyle}>
              <span>{text.shapeStyle}</span>
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
                    {mode === 'outline' ? text.shapeOutline : text.shapeFilled}
                  </button>
                ))}
              </div>
            </div>
            <div className="shape-picker" aria-label={text.shapeType}>
              <span>{text.shapeType}</span>
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
              <div className="shape-picker arrow-picker" aria-label={text.arrowStyle}>
                <span>{text.arrowStyle}</span>
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
                {text.textContent}
                <button
                  className="tool-options-close"
                  type="button"
                  aria-label={text.close}
                  title={text.close}
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
                placeholder={text.textPlaceholder}
                onChange={(event) => setTextToolValue(event.target.value)}
              />
            </label>
            <div className="right-click-toggle compact" aria-label={text.textDirection}>
              <span>{text.textDirection}</span>
              <div>
                {(['horizontal', 'vertical'] as TextDirection[]).map((direction) => (
                  <button
                    key={direction}
                    className={textToolDirection === direction ? 'active' : ''}
                    type="button"
                    aria-pressed={textToolDirection === direction}
                    onClick={() => setTextToolDirection(direction)}
                  >
                    {direction === 'horizontal' ? text.textHorizontal : text.textVertical}
                  </button>
                ))}
              </div>
            </div>
            <div className="tool-options-header">
              <span>{text.textSize}</span>
              <label className="tool-number-field" aria-label={text.textSize}>
                <input
                  type="number"
                  min={5}
                  max={72}
                  step={1}
                  value={textToolSize}
                  onChange={(event) => setTextToolSize(Math.min(72, Math.max(5, Number(event.target.value) || 5)))}
                />
                <span>{language === 'zh' ? '格' : 'cells'}</span>
              </label>
            </div>
            <input
              aria-label={text.textSize}
              type="range"
              min={5}
              max={72}
              step={1}
              value={textToolSize}
              onChange={(event) => setTextToolSize(Number(event.target.value))}
            />
            <div className="tool-options-header">
              <span>{text.textSpacing}</span>
              <label className="tool-number-field" aria-label={text.textSpacing}>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={1}
                  value={textToolSpacing}
                  onChange={(event) => setTextToolSpacing(Math.min(24, Math.max(0, Number(event.target.value) || 0)))}
                />
                <span>{language === 'zh' ? '格' : 'cells'}</span>
              </label>
            </div>
            <input
              aria-label={text.textSpacing}
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
              <strong>{text.tools.pan.title}</strong>
            </div>
            <p className="tool-hint">{text.panToolHint}</p>
          </div>
        )}
      </aside>
  );
}
