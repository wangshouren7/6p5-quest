import { Corpus } from "@/modules/listen/corpus/ui";

export default function ListenPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Listen</h1>

      <Corpus />
    </div>
  );
}
