import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">GeoNavi</span>
          <nav className="flex gap-4 text-sm">
            <Link
              href="/explore"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Explorer
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Visualize Geographic Flows
        </h1>
        <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          GeoNavi lets you explore origin-destination flow data on an interactive
          map. Upload your own CSV, JSON, or GeoJSON datasets or browse the
          built-in catalog.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/explore"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Open Explorer
          </Link>
        </div>

        <section className="mt-16 grid max-w-3xl gap-8 text-left sm:grid-cols-3">
          <div>
            <h3 className="font-semibold">Interactive Map</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Nodes and weighted edges drawn on OpenStreetMap tiles with
              click-to-inspect popups.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Flexible Data</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Supports CTPP commute data, custom CSV, JSON, and GeoJSON
              FeatureCollections.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Client-Side Processing</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Uploads are parsed entirely in the browser with DuckDB WASM.
              Nothing leaves your machine.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
        GeoNavi 2026 &middot; CIS 4914 Senior Design &middot; University of
        Florida
      </footer>
    </div>
  );
}
