import type { BeadProject } from '@/common/types';
import { singleton } from '@/service-core/di';
import { ui, type Language } from '@/config/localization';
import {
  downloadPrintPdf,
  downloadPrintPng,
  downloadProjectJson,
  downloadUsageWorkbook,
  type ExportLabels,
  type PrintExportOptions,
} from '@/services/domain/export/exporters';
import { BaseService } from '@/service-core/base-service';
import { ProjectService } from './project-service';
import { LocalizationService } from './localization-service';
import { NoticeService } from './notice-service';

export type { PrintExportOptions } from '@/services/domain/export/exporters';

@singleton()
export class ExportService extends BaseService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly localization: LocalizationService,
    private readonly notice: NoticeService,
  ) {
    super();
  }

  exportProject(project: BeadProject = this.projectService.snapshot.project): void {
    downloadProjectJson(project, this.exportLabels());
    this.notice.show((text) => text.recordExported);
  }

  exportUsage(project: BeadProject = this.projectService.snapshot.project): void {
    downloadUsageWorkbook(project, this.exportLabels());
    this.notice.show((text) => text.usageExported);
  }

  defaultProjectName(language: Language = this.localization.language): string {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    return ui[language].defaultProjectName(stamp);
  }

  exportPrint(options: PrintExportOptions): void {
    const exportOptions = {
      ...options,
      projectName: options.projectName?.trim() || this.defaultProjectName(),
      layerLabelPrefix: this.localization.text.layerPrefix,
      labels: this.exportLabels(),
    };
    if (options.format === 'pdf') downloadPrintPdf(this.projectService.snapshot.project, exportOptions);
    else downloadPrintPng(this.projectService.snapshot.project, exportOptions);
  }

  private exportLabels(): ExportLabels {
    const text = this.localization.text;
    return {
      exportAppName: text.exportAppName,
      defaultEditRecordName: text.defaultEditRecordName,
      defaultPatternName: text.defaultPatternName,
      exportEditSuffix: text.exportEditSuffix,
      exportUsageSuffix: text.exportUsageSuffix,
      exportBy: text.exportBy,
      exportSummaryProject: text.exportSummaryProject,
      exportSummaryBrand: text.exportSummaryBrand,
      exportSummaryCanvas: text.exportSummaryCanvas,
      exportSummaryTotal: text.exportSummaryTotal,
      exportSummaryColors: text.exportSummaryColors,
      exportSummaryPerPack: text.exportSummaryPerPack,
      exportSheetTotal: text.exportSheetTotal,
      exportSheetLabel: text.exportSheetLabel,
      exportColumnCode: text.exportColumnCode,
      exportColumnName: text.exportColumnName,
      exportColumnHex: text.exportColumnHex,
      exportColumnCount: text.exportColumnCount,
      exportColumnPacks: text.exportColumnPacks,
      exportUnitBeadsPerPack: text.exportUnitBeadsPerPack,
      exportTitleMeta: text.exportTitleMeta,
      layerFallbackPrefix: text.layerFallbackPrefix,
    };
  }
}
