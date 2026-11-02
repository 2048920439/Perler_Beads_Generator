import { BehaviorSubject, fromEvent } from 'rxjs';
import { singleton } from '@/service-core/di';
import { readonlyState } from '@/service-core/readonly-state';
import { isLanguage, ui, type Language } from '@/config/localization';
import { BaseService } from '@/service-core/base-service';

@singleton()
export class LocalizationService extends BaseService {
  private readonly state = new BehaviorSubject<Language>('zh');
  readonly snapshot$ = readonlyState(this.state);

  get language(): Language {
    return this.state.getValue();
  }

  setLanguage(language: Language): void {
    if (language !== this.language) this.state.next(language);
  }

  navigateLanguage(language: Language): void {
    if (typeof window === 'undefined' || language === this.language) return;
    const url = new URL(window.location.href);
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || !isLanguage(last)) return;
    segments[segments.length - 1] = language;
    url.pathname = `/${segments.join('/')}/`;
    // Locale pages share the same client workspace; keep its runtime and history.
    window.history.pushState(null, '', url.pathname + url.search + url.hash);
    this.setLanguage(language);
  }

  get text() { return ui[this.language]; }

  protected onBind(): void {
    this.own(this.snapshot$.subscribe((language) => {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = language;
        document.title = this.text.appName;
        document.querySelector?.('meta[name="description"]')?.setAttribute('content', this.text.description);
      }
    }));
    if (typeof window !== 'undefined') {
      this.own(fromEvent(window, 'popstate').subscribe(this.syncRouteLanguage));
    }
  }

  private readonly syncRouteLanguage = (): void => {
    const segment = window.location.pathname.split('/').filter(Boolean).pop();
    if (segment && isLanguage(segment)) this.setLanguage(segment);
  };
}
