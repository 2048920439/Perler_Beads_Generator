import { BehaviorSubject } from 'rxjs';
import { ui } from '@/config/localization';
import { BaseService } from '@/service-core/base-service';
import { LocalizationService } from './localization-service';

export class NoticeService extends BaseService {
  readonly snapshot$ = new BehaviorSubject(this.localization.text.workspaceReady);

  constructor(private readonly localization: LocalizationService) { super(); }

  show(message: string): void { this.snapshot$.next(message); }

  protected onActivate(): void {
    this.own(this.localization.snapshot$.subscribe((language) => {
      const current = this.snapshot$.getValue();
      if (current === ui.zh.workspaceReady || current === ui.en.workspaceReady) {
        this.show(this.localization.text.workspaceReady);
        return;
      }
      const generated = current.match(/^(\d+) (?:色 - (\d+) 颗 - 可编辑图案已生成。|colors - (\d+) beads - editable pattern ready\.)$/);
      if (generated) this.generated(Number(generated[1]), Number(generated[2] ?? generated[3]), language);
    }));
  }

  generated(colors: number, beads: number, language = this.localization.language): void {
    this.show(language === 'zh'
      ? `${colors} 色 - ${beads} 颗 - 可编辑图案已生成。`
      : `${colors} colors - ${beads} beads - editable pattern ready.`);
  }
}
