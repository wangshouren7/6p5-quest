"use client";

import { useObservable } from "rcrx";
import { useCorpus } from "./context";

const COLS_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const;

export function GridColsControl() {
  const corpus = useCorpus();
  const controls = useObservable(corpus.controls.value$);
  const gridCols = controls?.gridCols ?? 4;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label-text">每行列数</span>
      <select
        className="select select-bordered select-sm w-20"
        value={gridCols}
        onChange={(e) =>
          corpus.controls.change({
            gridCols: Number(e.target.value) as (typeof COLS_OPTIONS)[number],
          })
        }
        aria-label="网格每行列数"
      >
        {COLS_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
