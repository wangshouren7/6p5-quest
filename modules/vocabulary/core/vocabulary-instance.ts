import { VocabularyData } from "./vocabulary-data";

export interface IVocabularyInstance {
  readonly data: VocabularyData;
}

export class Vocabulary implements IVocabularyInstance {
  readonly data: VocabularyData;

  constructor() {
    this.data = new VocabularyData();
  }
}
