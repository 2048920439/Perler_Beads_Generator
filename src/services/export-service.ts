import type { BeadProject } from '@/common/types';
import type { Language } from '@/config/localization';
import {
  downloadPrintPdf,
  downloadPrintPng,
  downloadProjectJson,
  downloadUsageWorkbook,
  type PrintExportOptions,
} from '@/core/export/exporters';
import { BaseService } from '@/service-core/base-service';
import { ProjectService } from './project-service';
import { LocalizationService } from './localization-service';
import { NoticeService } from './notice-service';

export class ExportService extends BaseService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly localization: LocalizationService,
    private readonly notice: NoticeService,
  ) {
    super();
  }

  exportProject(project: BeadProject = this.projectService.snapshot.project): void {
    downloadProjectJson(project);
    this.notice.show(this.localization.text.recordExported);
  }

  exportUsage(project: BeadProject = this.projectService.snapshot.project): void {
    downloadUsageWorkbook(project);
    this.notice.show(this.localization.text.usageExported);
  }

  defaultProjectName(language: Language = this.localization.language): string {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    return language === 'zh' ? `拼豆图纸_${stamp}` : `Perler_Beads_${stamp}`;
  }

  exportPrint(options: PrintExportOptions): void {
    const project = this.projectService.snapshot.project;
    const exportOptions = {
      ...options,
      projectName: options.projectName?.trim() || this.defaultProjectName(),
      layerLabelPrefix: this.localization.language === 'en' ? 'Layer' : '图层',
    };
    if (options.format === 'pdf') downloadPrintPdf(project, exportOptions);
    else downloadPrintPng(project, exportOptions);
  }
}
