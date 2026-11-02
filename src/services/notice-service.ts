import { BehaviorSubject } from 'rxjs';
import { singleton } from '@/service-core/di';
import { readonlyState } from '@/service-core/readonly-state';
import { BaseService } from '@/service-core/base-service';
import { LocalizationService } from './localization-service';
import type { EditorText, Language } from '@/config/localization';

@singleton()
export class NoticeService extends BaseService {
  private readonly state: BehaviorSubject<string>;
  readonly snapshot$;
  private generatedState: { colors: number; beads: number } | null = null;
  private readyState = true;
  private message: ((text: EditorText) => string) | null = null;
  private plainMessage: string | null = null;
  private language: Language;

  constructor(private readonly localization: LocalizationService) {
    super();
    this.language = localization.language;
    this.state = new BehaviorSubject(this.localization.text.workspaceReady);
    this.snapshot$ = readonlyState(this.state);
  }

  get snapshot(): string { return this.state.getValue(); }

  show(message: string | ((text: EditorText) => string)): void {
    this.generatedState = null;
    this.readyState = false;
    this.message = typeof message === 'function' ? message : null;
    this.plainMessage = typeof message === 'string' ? message : null;
    this.state.next(typeof message === 'function' ? message(this.localization.text) : message);
  }

  protected onBind(): void {
    this.own(this.localization.snapshot$.subscribe((language) => {
      const changed = language !== this.language;
      this.language = language;
      if (this.message) {
        this.state.next(this.message(this.localization.text));
        return;
      }
      if (this.plainMessage !== null) {
        this.state.next(this.plainMessage);
        return;
      }
      if (this.generatedState) {
        this.state.next(this.localization.text.generatedPattern(this.generatedState.colors, this.generatedState.beads));
        return;
      }
      if (this.readyState || changed) {
        this.readyState = true;
        this.state.next(this.localization.text.workspaceReady);
      }
    }));
  }

  generated(colors: number, beads: number): void {
    this.message = null;
    this.plainMessage = null;
    this.readyState = false;
    this.generatedState = { colors, beads };
    this.state.next(this.localization.text.generatedPattern(colors, beads));
  }
}
