'use client';

import type { InjectionToken } from 'tsyringe';
import * as React from 'react';
import { BaseService } from './base-service';
import { Injector } from './service-injector';
import { LocalizationService } from '@/services/localization-service';
import type { Language } from '@/config/localization';

export function ServiceProvider({ children, language }: React.PropsWithChildren<{ language: Language }>) {
  const initialLanguage = React.useRef(language);

  React.useEffect(() => {
    Injector.bind(initialLanguage.current);
    return () => Injector.unbind();
  }, []);

  React.useEffect(() => {
    Injector.resolve(LocalizationService).setLanguage(language);
  }, [language]);

  return children;
}

export function useService<T extends BaseService>(token: InjectionToken<T>): T {
  return Injector.resolve<T>(token);
}
