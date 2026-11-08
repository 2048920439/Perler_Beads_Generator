import { BehaviorSubject } from 'rxjs';
import { singleton } from '@/service-core/di';
import { readonlyState } from '@/service-core/readonly-state';
import { referenceLongPressDelay, referenceShortcut } from '@/config/editor';
import { BaseService } from '@/service-core/base-service';
import { NoticeService } from './notice-service';

export type ReferenceSnapshot = {
  file: File | null; url: string | null; visible: boolean; opacity: number; scale: number;
  offset: { x: number; y: number }; adjusting: boolean; placement: 'below' | 'above';
};

@singleton()
export class ReferenceImageService extends BaseService {
  private readonly state = new BehaviorSubject<ReferenceSnapshot>({
    file: null, url: null, visible: false, opacity: 0.35, scale: 1,
    offset: { x: 0, y: 0 }, adjusting: false, placement: 'below',
  });
  readonly snapshot$ = readonlyState(this.state);

  constructor(private readonly notice: NoticeService) { super(); }
  get snapshot(): ReferenceSnapshot { return this.state.getValue(); }

  update(changes: Partial<Omit<ReferenceSnapshot, 'file' | 'url'>>): void {
    this.state.next({ ...this.snapshot, ...changes });
  }

  load(file: File): void {
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      this.notice.show((text) => text.unsupportedImage);
      return;
    }
    this.setImage(file, file);
    this.notice.show((text) => text.referenceImageSet(file.name));
  }

  setImage(file: File, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    this.releaseUrl();
    this.state.next({ ...this.snapshot, file, url, visible: true, scale: 1, offset: { x: 0, y: 0 }, adjusting: false });
  }

  resetTransform(): void { this.update({ scale: 1, offset: { x: 0, y: 0 }, adjusting: false }); }
  stepScale(direction: -1 | 1): void {
    this.update({ scale: Math.min(3, Math.max(0.25, this.snapshot.scale * (direction < 0 ? 0.94 : 1.06))) });
  }
  clear(): void {
    this.releaseUrl();
    this.state.next({ ...this.snapshot, file: null, url: null, visible: false, scale: 1, offset: { x: 0, y: 0 }, adjusting: false });
  }

  protected onBind(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.resetShortcut);
  }

  protected onUnbind(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.resetShortcut);
    }
    this.resetShortcut();
  }

  private pressedAt: number | null = null;
  private visibleBeforePress = false;
  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== referenceShortcut || event.repeat || event.ctrlKey || event.metaKey || event.altKey
      || event.shiftKey || event.isComposing || isEditableTarget(event.target) || !this.snapshot.url || this.pressedAt !== null) return;
    event.preventDefault();
    this.pressedAt = performance.now();
    this.visibleBeforePress = this.snapshot.visible;
    this.update({ visible: true });
  };
  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code !== referenceShortcut || this.pressedAt === null) return;
    event.preventDefault();
    this.update({ visible: performance.now() - this.pressedAt < referenceLongPressDelay && !this.visibleBeforePress });
    this.pressedAt = null;
  };
  private resetShortcut = (): void => {
    if (this.pressedAt !== null) this.update({ visible: false });
    this.pressedAt = null;
  };
  private releaseUrl(): void { if (this.snapshot.url) URL.revokeObjectURL(this.snapshot.url); }
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'));
}
