import Explorer from "../components/Explorer";

// The dataset-catalog explorer: browse datasets served by /api/datasets
// (including pipeline output in data/datasets/) or upload a file.
// Explorer is styled for light and dark OS themes, while the rest of the app
// is always dark, so give it the background its colours expect.
export default function CatalogPage() {
  return (
    <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Explorer />
    </div>
  );
}
