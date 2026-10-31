'use client';

import type { DependencyContainer, InjectionToken } from 'tsyringe';
import * as React from 'react';
import { BaseService } from './base-service';
import { createServiceScope } from './service-injector';

const ServiceContainerContext = React.createContext<DependencyContainer | null>(null);

export function ServiceProvider({ children }: React.PropsWithChildren) {
  const [scope] = React.useState(createServiceScope);

  React.useEffect(() => {
    scope.activate();
    return () => scope.deactivate();
  }, [scope]);

  return <ServiceContainerContext.Provider value={scope.injector}>{children}</ServiceContainerContext.Provider>;
}

export function useService<T extends BaseService>(token: InjectionToken<T>): T {
  const injector = React.useContext(ServiceContainerContext);
  if (!injector) throw new Error('useService must be used inside ServiceProvider.');
  return injector.resolve<T>(token);
}
