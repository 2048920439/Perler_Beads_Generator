import { BehaviorSubject } from 'rxjs';
import { languageKey, ui, type Language } from '@/config/localization';
import { BaseService } from '@/service-core/base-service';

export class LocalizationService extends BaseService {
  readonly snapshot$ = new BehaviorSubject<Language>(
    typeof window !== 'undefined' && readLanguage() === 'en' ? 'en' : 'zh',
  );

  get language(): Language { return this.snapshot$.getValue(); }
  get text() { return ui[this.language]; }

  setLanguage(language: Language): void {
    if (language !== this.language) this.snapshot$.next(language);
  }

  protected onActivate(): void {
    this.own(this.snapshot$.subscribe((language) => {
      if (typeof document !== 'undefined') document.documentElement.lang = language;
      try {
        localStorage.setItem(languageKey, language);
      } catch {
        // Editing remains available when browser storage is disabled.
      }
    }));
  }
}

function readLanguage(): string | null {
  try { return localStorage.getItem(languageKey); } catch { return null; }
}
