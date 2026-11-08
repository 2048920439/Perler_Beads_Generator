import './di';
import { container, type InjectionToken } from 'tsyringe';
import { LocalizationService } from '@/services/localization-service';
import { serviceModules } from '@/services/service-modules';
import { BaseService } from './base-service';
import { isLanguage, type Language } from '@/config/localization';

class RuntimeInjector {
  private readonly instances = new Set<BaseService>();
  private readonly localization: LocalizationService;
  private bound = false;

  constructor() {
    const serviceTypes = serviceModules.flat();
    serviceTypes.forEach((token) => container.afterResolution<BaseService>(
      token,
      (_token, result) => {
        if (!Array.isArray(result)) this.instances.add(result);
      },
      { frequency: 'Once' },
    ));
    serviceTypes.forEach((token) => container.resolve<BaseService>(token));
    this.localization = container.resolve(LocalizationService);
    if (typeof document !== 'undefined' && isLanguage(document.documentElement.lang)) {
      this.localization.setLanguage(document.documentElement.lang as Language);
    }
  }

  resolve<T extends BaseService>(token: InjectionToken<T>): T {
    return container.resolve(token);
  }

  bind(language: Language): void {
    this.localization.setLanguage(language);
    if (this.bound) return;
    this.bound = true;
    try {
      this.instances.forEach((service) => service.bind());
    } catch (error) {
      this.unbind();
      throw error;
    }
  }

  unbind(): void {
    if (!this.bound) return;
    this.bound = false;
    [...this.instances].reverse().forEach((service) => service.unbind());
  }
}

// Resolve the service graph once. React only attaches and detaches runtime events.
export const Injector = new RuntimeInjector();
