import { getErrorMessage } from "@/utils/error";
import { BehaviorSubject } from "rxjs";
import type {
  IVocabularyEntryListItem,
  IVocabularyFilter,
  IVocabularyFilterOptions,
} from "./types";

export interface IVocabularyResult {
  items: IVocabularyEntryListItem[];
  total: number;
}

export interface IVocabularyDataFetch {
  fetchEntries: (
    filter: IVocabularyFilter,
    opts: { page: number; pageSize: number },
  ) => Promise<IVocabularyResult>;
  fetchFilterOptions: () => Promise<IVocabularyFilterOptions | null>;
}

export interface IVocabularyDataOptions {
  fetch: IVocabularyDataFetch;
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

  private readonly _fetch: IVocabularyDataFetch;

  constructor(options: IVocabularyDataOptions) {
    this._fetch = options.fetch;
  }

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
    const opts = await this._fetch.fetchFilterOptions();
    this.filterOptions$.next(opts);
  }

  private async fetchWithState(page: number, pageSize: number): Promise<void> {
    this.filterLoading$.next(true);
    this.formError$.next(null);
    try {
      const filter = this.filter$.value;
      const { items, total } = await this._fetch.fetchEntries(filter, {
        page,
        pageSize,
      });
      this.result$.next({ items, total });
      this.page$.next(page);
    } catch (e) {
      this.formError$.next(getErrorMessage(e, "加载失败"));
    } finally {
      this.filterLoading$.next(false);
    }
  }

  async fetchEntries(): Promise<void> {
    const page = this.page$.value;
    const pageSize = this.pageSize$.value;
    await this.fetchWithState(page, pageSize);
  }

  async fetchEntriesPageOne(): Promise<void> {
    await this.fetchWithState(1, this.pageSize$.value);
  }

  async handlePageChange(newPage: number): Promise<void> {
    await this.fetchWithState(newPage, this.pageSize$.value);
  }

  async handlePageSizeChange(newSize: number): Promise<void> {
    this.pageSize$.next(newSize);
    await this.fetchWithState(1, newSize);
  }

  async handleRefresh(): Promise<void> {
    await this.handlePageChange(this.page$.value);
  }

  async handleFormSuccess(): Promise<void> {
    this.formError$.next(null);
    await this.loadFilterOptions();
  }
}
