**English** | [Português (Brasil)](README.pt-BR.md)

# GeoNavi

GeoNavi is a web app for exploring geographic flow data on an interactive map. You upload a file of places and the movement between them (for example, how many people commute from one neighborhood to another), and GeoNavi draws the points and flows so you can explore them.

The project was built for the University of Florida Senior Design course (CIS 4914, Fall 2026), with Dr. Hu as advisor. The main test dataset is Census Transportation Planning Products (CTPP) data: tract-to-tract commute flows for Florida, with about 8,000 census tracts and 220,000 flows.

**Live site:** https://geo-navi2026.vercel.app

## Features

- **Upload a file and see it on a map.** Drag and drop a file, or use "Browse files." Points appear as dots and flows appear as lines. Thicker lines mean bigger flows.
- **Many file formats.** CSV, JSON, GeoJSON, GeoParquet, KML, GPX, and zipped shapefiles. See [Supported formats](#supported-formats).
- **Your data stays on your computer.** Files are processed in the browser with DuckDB WASM. Nothing is uploaded to a server.
- **Column styling.** Each column in the sidebar has a Style menu. A column can drive the color, size, or shape of the points, or the color and width of the flows. A legend explains the styles.
- **Flow lines.** The "Flow lines" section in the sidebar sets how every flow is drawn, whatever the columns say: a color (a column set to Color overrides it), solid, dashed, dotted, dash-dot, or long dash lines, dashes that move from origin to destination, and arrows for the direction (off by default). Arrows and animation switch off while more than 10,000 flows are shown; filter or isolate points to bring them back.
- **Filter bar.** The bar at the bottom of the map steps through the values of any column you pick (hours of the day, number ranges, or categories) and shows only the matching points or flows. It starts on a time column when the data has one. Use **One** to pick a single value or **Many** to select a range, and press play to animate it.
- **English and Portuguese.** Switch the interface language with the EN / PT button in the top-right corner.
- **Swap data without leaving the map.** Use "New upload" or drop a new file anywhere on the map.
- **Sample dataset.** "Try the sample dataset" on the upload screen loads example data, so you can try the app without a file.

## Supported formats

| Format | Extension | Notes |
| --- | --- | --- |
| Flow CSV | `.csv` | Needs latitude and longitude columns for the origin and destination. Names are detected in English or Portuguese, for example `O_lat`, `origin_lat`, or `latitude_origem`. Origin/destination id columns (`Otract`, `origem`, `zona_destino`, …) and a flow size column (`EST`, `weight`, `trips`, `viagens`, …) are optional. Commas or semicolons as separators, and decimal points or decimal commas (`-23,55`), both work. A column named `time`, `hour`, or `hora` starts the filter bar on the hours of the day. |
| GeoNavi JSON | `.json` | Our own format with `nodes` and `edges`. See [docs/data-contract.md](docs/data-contract.md). |
| GeoJSON | `.geojson`, `.json` | Point and LineString features. Lines can have `source`, `target`, and `weight` properties. |
| GeoParquet | `.parquet`, `.geoparquet` | WKB geometry in WGS 84 (latitude and longitude). |
| KML | `.kml` | Placemarks with points and lines. |
| GPX | `.gpx` | Waypoints, tracks, and routes. |
| Shapefile | `.zip` | Upload the zip itself, not the files inside it. It must contain at least `.shp` and `.dbf`. Include `.shx` and `.prj` if you have them. |

**Limits:**
- Files up to 50 MB.
- Only points and lines. Polygon data (areas) is not supported.
- Coordinates must be latitude and longitude (WGS 84).

## Sample files

Test files are in [`data/test/`](data/test/):

| File | What it contains |
| --- | --- |
| `flow_demo.json`, `flow_demo.geojson`, `flow_demo.parquet` | A few Gainesville tracts and the flows between them, in three formats |
| `flows_hourly.csv` | Flows with a `time` column, for trying the filter bar |
| `sao_paulo_viagens.csv` | Fictional commute flows between São Paulo districts, in Brazilian format (semicolons, decimal commas, Portuguese column names) |
| `tracts_demo.geojson` | Points only (no flows), with population, income, and land use columns for trying the styling |

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/GeoNavi2026/GeoNavi2026.git
cd GeoNavi2026
npm install
npm run dev
```

Then open http://localhost:3000.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build |
| `npm start` | Runs the production build |
| `npm run lint` | Checks the code with ESLint |

## How it works

1. **Upload.** The browser reads the file. CSV, JSON, and GeoParquet are parsed with DuckDB WASM. KML and GPX use `@tmcw/togeojson`, and shapefiles use `shpjs`.
2. **Convert.** Every format is converted into one shared shape: a list of **nodes** (points) and **edges** (flows between points). The types are in `lib/types.ts`.
3. **Draw.** MapLibre GL draws the nodes and edges on an OpenStreetMap base map.

## Project structure

| Path | Contents |
| --- | --- |
| `app/` | Pages: upload screen (`/`), map (`/explore`), and dataset catalog (`/catalog`) |
| `app/components/` | Interface components (map, sidebar, legend, filter bar, language switch) |
| `app/api/datasets/` | API that lists and serves datasets stored in `data/datasets/` |
| `lib/process-upload.ts` | Reads every upload format and converts it to nodes and edges |
| `lib/csv-columns.ts` | Finds the flow columns in a CSV (English or Portuguese names) and reads numbers in either format |
| `lib/types.ts` | Data contract shared by the parser, API, and map |
| `lib/point-style.ts`, `lib/filter-axis.ts` | Column styling and filter bar logic |
| `lib/i18n.tsx` | English and Portuguese interface text |
| `docs/data-contract.md` | Data format documentation |
| `data/test/` | Sample files |

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/datasets` | List of available datasets |
| `GET /api/datasets/[id]` | One dataset with its nodes and edges |

## Known limitations

- Column names from uploaded files are shown as they are, not translated.
- Polygon data is not supported.
- Uploaded data is not saved. Reloading the page clears it.

## Team

University of Florida, CIS 4914 Senior Design, Fall 2026

- Amogh Allani
- Ryan Feldbush
- Tyler Pencinger
- Zach Pinet

Advisor: Dr. Hu
