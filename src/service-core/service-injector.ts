import './di';
import { container, type InjectionToken } from 'tsyringe';
import { AdjustmentService } from '@/services/adjustment-service';
import { CanvasEditService } from '@/services/canvas-edit-service';
import { EditorService } from '@/services/editor-service';
import { EditorQueryService } from '@/services/editor-query-service';
import { ExportService } from '@/services/export-service';
import { ImportService } from '@/services/import-service';
import { LayerService } from '@/services/layer-service';
import { LocalizationService } from '@/services/localization-service';
import { NoticeService } from '@/services/notice-service';
import { PaletteService } from '@/services/palette-service';
import { ProjectService } from '@/services/project-service';
import { ReferenceImageService } from '@/services/reference-image-service';
import { ToolService } from '@/services/tool-service';
import { WorkspaceService } from '@/services/workspace-service';
import { WorkspaceViewService } from '@/services/workspace-view-service';
import { BaseService } from './base-service';
import { isLanguage, type Language } from '@/config/localization';

const serviceTypes = [
  AdjustmentService, CanvasEditService, EditorService, EditorQueryService, ExportService,
  ImportService, LayerService, LocalizationService, NoticeService, PaletteService,
  ProjectService, ReferenceImageService, ToolService, WorkspaceService, WorkspaceViewService,
];
class RuntimeInjector {
  private readonly instances = new Set<BaseService>();
  private readonly localization: LocalizationService;
  private bound = false;

  constructor() {
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
