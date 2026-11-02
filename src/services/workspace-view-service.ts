import { BehaviorSubject } from 'rxjs';
import { singleton } from '@/service-core/di';
import { readonlyState } from '@/service-core/readonly-state';
import type { ProjectSettings } from '@/common/types';
import { BaseService } from '@/service-core/base-service';
import { EditorService } from './editor-service';

export type HoverCell = { x: number; y: number; colorId: string | null };

// Hover has its own stream so pointer movement does not update every panel.
@singleton()
export class WorkspaceViewService extends BaseService {
  private readonly hover = new BehaviorSubject<HoverCell | null>(null);
  private readonly state = new BehaviorSubject({ highlightedColorId: null as string | null, showIsolatedBeads: false });
  readonly hoverCell$ = readonlyState(this.hover);
  readonly snapshot$ = readonlyState(this.state);

  constructor(private readonly editor: EditorService) { super(); }

  get snapshot(): { highlightedColorId: string | null; showIsolatedBeads: boolean } {
    return this.state.getValue();
  }

  updateSettings(changes: Partial<ProjectSettings>): void { this.editor.updateSettings(changes); }

  setHoverCell(cell: HoverCell | null): void {
    const current = this.hover.getValue();
    if (current?.x === cell?.x && current?.y === cell?.y && current?.colorId === cell?.colorId) return;
    this.hover.next(cell);
  }

  highlightColor(highlightedColorId: string | null): void {
    this.state.next({ ...this.snapshot, highlightedColorId });
  }

  setShowIsolatedBeads(showIsolatedBeads: boolean): void {
    this.state.next({ ...this.snapshot, showIsolatedBeads });
  }
}
