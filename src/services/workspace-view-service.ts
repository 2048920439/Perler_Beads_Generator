import { BehaviorSubject } from 'rxjs';
import { BaseService } from '@/service-core/base-service';

export type HoverCell = { x: number; y: number; colorId: string | null };

// Hover has its own stream so pointer movement does not update every panel.
export class WorkspaceViewService extends BaseService {
  readonly hoverCell$ = new BehaviorSubject<HoverCell | null>(null);
  readonly snapshot$ = new BehaviorSubject({ highlightedColorId: null as string | null, showIsolatedBeads: false });

  setHoverCell(cell: HoverCell | null): void {
    const current = this.hoverCell$.getValue();
    if (current?.x === cell?.x && current?.y === cell?.y && current?.colorId === cell?.colorId) return;
    this.hoverCell$.next(cell);
  }

  highlightColor(highlightedColorId: string | null): void {
    this.snapshot$.next({ ...this.snapshot$.getValue(), highlightedColorId });
  }

  setShowIsolatedBeads(showIsolatedBeads: boolean): void {
    this.snapshot$.next({ ...this.snapshot$.getValue(), showIsolatedBeads });
  }
}
