import { BehaviorSubject } from 'rxjs';
import { referenceLongPressDelay, referenceShortcut } from '@/config/editor';
import { BaseService } from '@/service-core/base-service';
import { LocalizationService } from './localization-service';
import { NoticeService } from './notice-service';

export type ReferenceSnapshot = {
  file: File | null; url: string | null; visible: boolean; opacity: number; scale: number;
  offset: { x: number; y: number }; adjusting: boolean; placement: 'below' | 'above';
};

export class ReferenceImageService extends BaseService {
  readonly snapshot$ = new BehaviorSubject<ReferenceSnapshot>({
    file: null, url: null, visible: false, opacity: 0.35, scale: 1,
    offset: { x: 0, y: 0 }, adjusting: false, placement: 'below',
  });

  constructor(private readonly localization: LocalizationService, private readonly notice: NoticeService) { super(); }
  get snapshot(): ReferenceSnapshot { return this.snapshot$.getValue(); }

  update(changes: Partial<Omit<ReferenceSnapshot, 'file' | 'url'>>): void {
    this.snapshot$.next({ ...this.snapshot, ...changes });
  }

  load(file: File): void {
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      this.notice.show(this.localization.text.unsupportedImage);
      return;
    }
    this.setImage(file, file);
      this.notice.show(this.localization.text.referenceImageSet(file.name));
  }

  setImage(file: File, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    this.releaseUrl();
    this.snapshot$.next({ ...this.snapshot, file, url, visible: true, scale: 1, offset: { x: 0, y: 0 }, adjusting: false });
  }

  resetTransform(): void { this.update({ scale: 1, offset: { x: 0, y: 0 }, adjusting: false }); }
  clear(): void {
    this.releaseUrl();
    this.snapshot$.next({ ...this.snapshot, file: null, url: null, visible: false, scale: 1, offset: { x: 0, y: 0 }, adjusting: false });
  }

  protected onActivate(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.resetShortcut);
  }

  protected onDeactivate(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.resetShortcut);
    }
    this.resetShortcut();
    this.clear();
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
