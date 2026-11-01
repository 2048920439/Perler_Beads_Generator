import { BehaviorSubject } from 'rxjs';
import { ui, type Language } from '@/config/localization';
import { BaseService } from '@/service-core/base-service';

export class LocalizationService extends BaseService {
  readonly snapshot$: BehaviorSubject<Language>;

  constructor(language: Language) {
    super();
    this.snapshot$ = new BehaviorSubject(language);
  }

  get language(): Language {
    return this.snapshot$.getValue();
  }

  get text() { return ui[this.language]; }

  protected onActivate(): void {
    this.own(this.snapshot$.subscribe((language) => {
      if (typeof document !== 'undefined') document.documentElement.lang = language;
    }));
  }
}
