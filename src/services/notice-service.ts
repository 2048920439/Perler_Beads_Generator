import { BehaviorSubject } from 'rxjs';
import { BaseService } from '@/service-core/base-service';
import { LocalizationService } from './localization-service';

export class NoticeService extends BaseService {
  readonly snapshot$: BehaviorSubject<string>;
  private generatedState: { colors: number; beads: number } | null = null;
  private readyState = true;

  constructor(private readonly localization: LocalizationService) {
    super();
    this.snapshot$ = new BehaviorSubject(this.localization.text.workspaceReady);
  }

  show(message: string): void {
    this.generatedState = null;
    this.readyState = false;
    this.snapshot$.next(message);
  }

  protected onActivate(): void {
    this.own(this.localization.snapshot$.subscribe(() => {
      if (this.generatedState) {
        this.snapshot$.next(this.localization.text.generatedPattern(this.generatedState.colors, this.generatedState.beads));
        return;
      }
      if (this.readyState) {
        this.snapshot$.next(this.localization.text.workspaceReady);
      }
    }));
  }

  generated(colors: number, beads: number): void {
    this.readyState = false;
    this.generatedState = { colors, beads };
    this.snapshot$.next(this.localization.text.generatedPattern(colors, beads));
  }
}
