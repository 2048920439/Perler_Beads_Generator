import { AdjustmentService } from './adjustment-service';
import { CanvasEditService } from './canvas-edit-service';
import { EditorService } from './editor-service';
import { EditorQueryService } from './editor-query-service';
import { ExportService } from './export-service';
import { ImportService } from './import-service';
import { LayerService } from './layer-service';
import { LocalizationService } from './localization-service';
import { NoticeService } from './notice-service';
import { PaletteService } from './palette-service';
import { ProjectService } from './project-service';
import { ReferenceImageService } from './reference-image-service';
import { ToolService } from './tool-service';
import { WorkspaceService } from './workspace-service';
import { WorkspaceViewService } from './workspace-view-service';

// Each feature lists its runtime services here; constructor injection orders dependencies.
export const serviceModules = [
  [LocalizationService, NoticeService],
  [ProjectService, EditorService, EditorQueryService],
  [PaletteService, LayerService, AdjustmentService],
  [ToolService, CanvasEditService, WorkspaceViewService, WorkspaceService],
  [ImportService, ReferenceImageService, ExportService],
];
