import 'reflect-metadata';
import { container, type InjectionToken } from 'tsyringe';
import { AdjustmentService } from '@/services/adjustment-service';
import { ExportService } from '@/services/export-service';
import { ImageImportService } from '@/services/image-import-service';
import { LayerService } from '@/services/layer-service';
import { ProjectService } from '@/services/project-service';
import { ToolService } from '@/services/tool-service';
import { LocalizationService } from '@/services/localization-service';
import { NoticeService } from '@/services/notice-service';
import { PaletteService } from '@/services/palette-service';
import { ReferenceImageService } from '@/services/reference-image-service';
import { WorkspaceService } from '@/services/workspace-service';
import { WorkspaceViewService } from '@/services/workspace-view-service';
import { EditorService } from '@/services/editor-service';
import { BaseService } from './base-service';

export function createServiceScope() {
  const injector = container.createChildContainer();
  const services: BaseService[] = [];
  function register<T extends BaseService>(token: InjectionToken<T>, service: T): T {
    injector.registerInstance(token, service);
    services.push(service);
    return service;
  }
  const project = register(ProjectService, new ProjectService());
  const localization = register(LocalizationService, new LocalizationService());
  const palette = register(PaletteService, new PaletteService());
  register(WorkspaceViewService, new WorkspaceViewService());
  const notice = register(NoticeService, new NoticeService(localization));
  const reference = register(ReferenceImageService, new ReferenceImageService(localization, notice));
  const tools = register(ToolService, new ToolService(project, localization, notice));
  const layers = register(LayerService, new LayerService(project, localization));
  const images = register(ImageImportService, new ImageImportService(project, palette, reference, localization, notice, layers));
  register(AdjustmentService, new AdjustmentService(project, palette, localization, notice));
  register(ExportService, new ExportService(project, localization, notice));
  register(WorkspaceService, new WorkspaceService(project, images, reference, palette, tools, localization, notice));
  register(EditorService, new EditorService(project, palette, localization, injector.resolve(WorkspaceViewService)));

  return {
    injector,
    activate: () => services.forEach((service) => service.activate()),
    deactivate: () => [...services].reverse().forEach((service) => service.deactivate()),
  };
}
