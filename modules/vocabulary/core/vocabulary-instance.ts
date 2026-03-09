import type { IVocabularyDataFetch } from "./vocabulary-data";
import { VocabularyData } from "./vocabulary-data";

export interface IVocabularyInstanceOptions {
  fetch: IVocabularyDataFetch;
}

export interface IVocabularyInstance {
  readonly data: VocabularyData;
}

export class Vocabulary implements IVocabularyInstance {
  readonly data: VocabularyData;

  constructor(options: IVocabularyInstanceOptions) {
    this.data = new VocabularyData({ fetch: options.fetch });
  }
}
