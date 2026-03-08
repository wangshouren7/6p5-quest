import { BehaviorSubject } from "rxjs";
import { getVocabularyEntries, getVocabularyFilterOptions } from "../actions";
import type {
    IVocabularyEntryListItem,
    IVocabularyFilter,
    IVocabularyFilterOptions,
} from "./types";

export interface IVocabularyResult {
  items: IVocabularyEntryListItem[];
  total: number;
}

export class VocabularyData {
  readonly filter$ = new BehaviorSubject<IVocabularyFilter>({});
  readonly filterOptions$ =
    new BehaviorSubject<IVocabularyFilterOptions | null>(null);
  readonly result$ = new BehaviorSubject<IVocabularyResult | null>(null);
  readonly page$ = new BehaviorSubject<number>(1);
  readonly pageSize$ = new BehaviorSubject<number>(200);
  readonly filterLoading$ = new BehaviorSubject<boolean>(false);
  readonly formError$ = new BehaviorSubject<string | null>(null);

  setFilter(
    value: IVocabularyFilter | ((prev: IVocabularyFilter) => IVocabularyFilter),
  ) {
    const next =
      typeof value === "function" ? value(this.filter$.value) : value;
    this.filter$.next(next);
  }

  setFormError(
    value: string | null | ((prev: string | null) => string | null),
  ) {
    const next =
      typeof value === "function" ? value(this.formError$.value) : value;
    this.formError$.next(next);
  }

  setPage(page: number) {
    this.page$.next(page);
  }

  setPageSize(pageSize: number) {
    this.pageSize$.next(pageSize);
  }

  async loadFilterOptions(): Promise<void> {
    const opts = await getVocabularyFilterOptions();
    this.filterOptions$.next(opts);
  }

  async fetchEntries(): Promise<void> {
    this.filterLoading$.next(true);
    this.formError$.next(null);
    try {
      const filter = this.filter$.value;
      const page = this.page$.value;
      const pageSize = this.pageSize$.value;
      const { items, total } = await getVocabularyEntries(filter, {
        page,
        pageSize,
      });
      this.result$.next({ items, total });
    } catch (e) {
      this.formError$.next(e instanceof Error ? e.message : "加载失败");
    } finally {
      this.filterLoading$.next(false);
    }
  }

  async fetchEntriesPageOne(): Promise<void> {
    this.filterLoading$.next(true);
    this.formError$.next(null);
    try {
      const filter = this.filter$.value;
      const pageSize = this.pageSize$.value;
      const { items, total } = await getVocabularyEntries(filter, {
        page: 1,
        pageSize,
      });
      this.result$.next({ items, total });
      this.page$.next(1);
    } catch (e) {
      this.formError$.next(e instanceof Error ? e.message : "加载失败");
    } finally {
      this.filterLoading$.next(false);
    }
  }

  async handlePageChange(newPage: number): Promise<void> {
    this.filterLoading$.next(true);
    this.formError$.next(null);
    try {
      const filter = this.filter$.value;
      const pageSize = this.pageSize$.value;
      const { items, total } = await getVocabularyEntries(filter, {
        page: newPage,
        pageSize,
      });
      this.result$.next({ items, total });
      this.page$.next(newPage);
    } catch (e) {
      this.formError$.next(e instanceof Error ? e.message : "加载失败");
    } finally {
      this.filterLoading$.next(false);
    }
  }

  async handlePageSizeChange(newSize: number): Promise<void> {
    this.pageSize$.next(newSize);
    this.filterLoading$.next(true);
    this.formError$.next(null);
    try {
      const filter = this.filter$.value;
      const { items, total } = await getVocabularyEntries(filter, {
        page: 1,
        pageSize: newSize,
      });
      this.result$.next({ items, total });
      this.page$.next(1);
    } catch (e) {
      this.formError$.next(e instanceof Error ? e.message : "加载失败");
    } finally {
      this.filterLoading$.next(false);
    }
  }

  async handleRefresh(): Promise<void> {
    await this.handlePageChange(this.page$.value);
  }

  async handleFormSuccess(): Promise<void> {
    this.formError$.next(null);
    await this.loadFilterOptions();
  }
}
