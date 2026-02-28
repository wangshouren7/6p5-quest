import {Corpus} from "@/modules/listen/corpus"

export default function ListenPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Listen</h1>
            <p className="text-gray-600">Welcome to the listen page.</p>

            <Corpus/>
        </div>
    );
}