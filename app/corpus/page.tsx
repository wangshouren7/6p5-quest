import { Corpus } from "@/modules/corpus/ui";

export default function CorpusPage() {
  return (
    <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-8">
      <h1 className="text-2xl font-bold mb-6 sm:text-3xl">语料库</h1>

      <Corpus />
    </div>
  );
}
