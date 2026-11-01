import { BehaviorSubject } from 'rxjs';
import { defaultColorId, defaultRecentColorIds } from '@/config/editor';
import type { PaletteColor } from '@/common/types';
import { basicPalette, completePalette, getColor } from '@/services/domain/palette';
import { BaseService } from '@/service-core/base-service';

export type PaletteMode = 'basic' | 'complete';
type PaletteSnapshot = { mode: PaletteMode; selectedColorId: string; recentColorIds: string[] };

export class PaletteService extends BaseService {
  readonly snapshot$ = new BehaviorSubject<PaletteSnapshot>({
    mode: 'basic', selectedColorId: defaultColorId, recentColorIds: [...defaultRecentColorIds],
  });

  get snapshot(): PaletteSnapshot { return this.snapshot$.getValue(); }
  get colors() { return this.snapshot.mode === 'basic' ? basicPalette : completePalette; }

  getColor(colorId: string | null): PaletteColor | undefined {
    return getColor(colorId);
  }

  getColors(groupId = 'all'): PaletteColor[] {
    return groupId === 'all' ? this.colors : this.colors.filter((color) => color.group === groupId);
  }

  selectColor(colorId: string, options: { updateRecent?: boolean } = {}): void {
    if (!getColor(colorId)) return;
    const recentColorIds = options.updateRecent === false
      ? this.snapshot.recentColorIds
      : [colorId, ...this.snapshot.recentColorIds.filter((id) => id !== colorId)].slice(0, 7);
    this.snapshot$.next({ ...this.snapshot, selectedColorId: colorId, recentColorIds });
  }

  setMode(mode: PaletteMode): void {
    const colors = mode === 'basic' ? basicPalette : completePalette;
    const selectedColorId = colors.some((color) => color.id === this.snapshot.selectedColorId)
      ? this.snapshot.selectedColorId : colors[0].id;
    this.snapshot$.next({ ...this.snapshot, mode, selectedColorId });
  }

  resetSelection(): void {
    this.snapshot$.next({
      ...this.snapshot, selectedColorId: defaultColorId, recentColorIds: [...defaultRecentColorIds],
    });
  }
}
