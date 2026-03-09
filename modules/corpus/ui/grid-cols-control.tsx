"use client";

import { GridColsControl as GridColsControlUI } from "@/modules/ui/grid-cols-control";
import { useObservable } from "rcrx";
import { useCorpus } from "./context";

/** 语料库网格列数：从 context 取 controls，控件与网格均使用同一列数值。 */
export function GridColsControl() {
  const corpus = useCorpus();
  const controls = useObservable(corpus.controls.value$);
  const gridCols = controls?.gridCols ?? 4;

  return (
    <GridColsControlUI
      value={gridCols}
      onChange={(cols) => corpus.controls.change({ gridCols: cols })}
    />
  );
}
