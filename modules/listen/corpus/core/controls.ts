import { BehaviorSubject } from "rxjs";
import { DEFAULT_CORPUS_CONTROLS } from "./constants";
import type { IControls, ICorpusControls } from "./types";

export class Controls implements IControls {
  value$: BehaviorSubject<ICorpusControls> = new BehaviorSubject(
    DEFAULT_CORPUS_CONTROLS,
  );

  change(params: Partial<ICorpusControls>) {
    this.value$.next({
      ...this.value$.value,
      ...params,
    });
  }
}
