**English** | [Português (Brasil)](README.pt-BR.md)

# GeoNavi

GeoNavi is a web app for exploring geographic flow data on an interactive map. You upload a file of places and the movement between them (for example, how many people commute from one neighborhood to another), and GeoNavi draws the points and flows so you can explore them.

The project was built for the University of Florida Senior Design course (CIS 4914, Fall 2026), with Dr. Hu as advisor. The main test dataset is Census Transportation Planning Products (CTPP) data: tract-to-tract commute flows for Florida, with about 8,000 census tracts and 220,000 flows.

**Live site:** https://geo-navi2026.vercel.app

## Features

- **Upload a file and see it on a map.** Drag and drop a file, or use "Browse files." Points appear as dots and flows appear as lines. Thicker lines mean bigger flows.
- **Many file formats.** CSV, JSON, GeoJSON, GeoParquet, KML, GPX, and zipped shapefiles. See [Supported formats](#supported-formats).
- **Your data stays on your computer.** Files are processed in the browser with DuckDB WASM. Nothing is uploaded to a server.
- **Column styling.** Each column in the sidebar has a Style menu. A column can drive the color, size, or shape of the points. A legend explains the styles.
- **Time slider.** Assign a column to Time and the slider steps through its values (hours of the day, numbers, or categories), showing only the points or flows for that step. Press play to animate it.
- **Swap data without leaving the map.** Use "New upload" or drop a new file anywhere on the map.
- **Sample dataset.** "Try the sample dataset" on the upload screen loads example data, so you can try the app without a file.

## Supported formats

| Format | Extension | Notes |
| --- | --- | --- |
| Flow CSV | `.csv` | Needs these columns: `Otract`, `Dtract`, `EST`, `O_lat`, `O_lon`, `D_lat`, `D_lon` (origin, destination, flow size, and coordinates). A column named `time`, `hour`, or `timestamp` is used for the time slider. |
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
| `flows_hourly.csv` | Flows with a `time` column, for trying the time slider |
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
| `app/components/` | Interface components (map, sidebar, legend, time slider) |
| `app/api/datasets/` | API that lists and serves datasets stored in `data/datasets/` |
| `lib/process-upload.ts` | Reads every upload format and converts it to nodes and edges |
| `lib/types.ts` | Data contract shared by the parser, API, and map |
| `lib/point-style.ts`, `lib/time-axis.ts` | Column styling and time slider logic |
| `docs/data-contract.md` | Data format documentation |
| `data/test/` | Sample files |

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/datasets` | List of available datasets |
| `GET /api/datasets/[id]` | One dataset with its nodes and edges |

## Known limitations

- The interface is only in English for now. Portuguese is in progress.
- Polygon data is not supported.
- Uploaded data is not saved. Reloading the page clears it.

## Team

University of Florida, CIS 4914 Senior Design, Fall 2026

- Amogh Allani
- Ryan Feldbush
- Tyler Pencinger
- Zach Pinet

Advisor: Dr. Hu
