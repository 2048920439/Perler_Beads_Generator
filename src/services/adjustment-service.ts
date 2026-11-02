import { BehaviorSubject } from 'rxjs';
import { singleton } from '@/service-core/di';
import { readonlyState } from '@/service-core/readonly-state';
import { defaultAdjustments } from '@/config/editor';
import type { EditorText } from '@/config/localization';
import { BaseService } from '@/service-core/base-service';
import { hasAdjustments, type AdjustmentSettings, type LayerEffect } from './domain/adjustment-operations';
import type { CellCommand } from './domain/editing';
import { EditorService, type EditHandle } from './editor-service';
import { NoticeService } from './notice-service';
import { PaletteService } from './palette-service';

@singleton()
export class AdjustmentService extends BaseService {
  private readonly state = new BehaviorSubject({
    adjustments: { ...defaultAdjustments }, colorCleanupStrength: 2, layerColorLimit: 16,
  });
  readonly snapshot$ = readonlyState(this.state);
  private session: EditHandle | null = null;

  constructor(
    private readonly editor: EditorService,
    private readonly palette: PaletteService,
    private readonly notice: NoticeService,
  ) { super(); }

  get snapshot() { return this.state.getValue(); }
  hasAdjustments(adjustments: AdjustmentSettings): boolean { return hasAdjustments(adjustments); }

  setAdjustment(key: keyof AdjustmentSettings, value: number): void {
    if (!this.canEdit()) return;
    if (!Number.isFinite(value)) return;
    if (this.session && !this.editor.isEditActive(this.session)) this.endSession();
    const settings = { ...this.snapshot.adjustments, [key]: value };
    if (!this.session) this.session = this.editor.beginEdit();
    if (!this.session) return;
    const result = this.editor.updateEdit(this.session, { type: 'adjust', settings, palette: this.palette.colors });
    if (result.status === 'rejected') return;
    this.state.next({ ...this.snapshot, adjustments: settings });
  }

  reset(): void {
    if (this.session) this.editor.cancelEdit(this.session);
    this.endSession();
  }

  applyEffect(effect: LayerEffect): void {
    this.run({ type: 'effect', effect, palette: this.palette.colors },
      (changed) => (text) => text.effectApplied(
        effect === 'invert' ? text.invertEffect : effect === 'grayscale' ? text.grayscaleEffect : text.blackWhiteEffect,
        changed,
      ));
  }
  setColorCleanupStrength(value: number): void {
    if (Number.isFinite(value)) this.state.next({ ...this.snapshot, colorCleanupStrength: value });
  }
  cleanup(): void {
    this.run({ type: 'cleanup', palette: this.palette.colors, strength: this.snapshot.colorCleanupStrength },
      (changed) => (text) => text.layerColorsCleaned(changed));
  }
  setLayerColorLimit(value: number): void {
    if (Number.isFinite(value)) this.state.next({ ...this.snapshot, layerColorLimit: value });
  }
  limitColors(): void {
    const limit = this.snapshot.layerColorLimit;
    this.run({ type: 'limit', palette: this.palette.colors, limit },
      (changed) => (text) => text.layerColorsLimited(changed, limit));
  }

  protected onBind(): void {
    this.own(this.editor.session$.subscribe((handle) => {
      if (this.session && handle !== this.session) this.endSession();
    }));
  }
  private endSession(): void {
    this.session = null;
    this.state.next({ ...this.snapshot, adjustments: { ...defaultAdjustments } });
  }
  private canEdit(): boolean {
    if (!this.editor.activeLayer.locked) return true;
    this.notice.show((text) => text.adjustmentLocked);
    return false;
  }
  private run(command: CellCommand, message: (changed: number) => (text: EditorText) => string): void {
    if (!this.canEdit()) return;
    if (this.session) this.editor.finishEdit(this.session);
    this.endSession();
    const result = this.editor.execute(command);
    if (result.status !== 'rejected') this.notice.show(message(result.affected ?? 0));
  }
}
