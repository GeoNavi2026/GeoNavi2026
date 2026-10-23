# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The map screen's "New upload" button opens the file picker and replaces the
  data in place, like "Browse files" on the upload screen, and files can be
  dropped anywhere on the map screen. Styles, the selected hour and the
  legend reset for the new data.
- Column-driven point styling on the map screen: a style menu next to each
  column assigns it to Color (Sunset ramp for numbers, rainbow for text),
  Size (numbers only) or Shape (columns with up to 6 distinct values), with
  linear/quantile/log and reverse options for number colours, and a legend
  with collapsible sections. Columns that only exist on flows show "Flows";
  lat/lon columns show "Position".
- Upload screen at `/` matching the Figma design: dark title card over a globe
  graphic, a drag-and-drop upload box (CSV, JSON, GeoJSON, GeoParquet, KML, GPX
  or zipped shapefile, up to 50 MB) and a "Try the sample dataset" link.
- Dataset catalog explorer at `/catalog`: the earlier explorer with the dataset
  dropdown, for browsing datasets served by `/api/datasets`.
- Map screen at `/explore` matching the Figma design: sidebar with the uploaded
  file's name, row count and column titles (with detected types), node name
  labels, dark popups, zoom buttons, and a time slider that filters edges by
  hour of day. The slider only appears when the data has a time column: `t` on
  JSON/GeoJSON edges, or a CSV column named `t`, `time`, `hour`, `timestamp` or
  `datetime`, which is tagged "time" in the column list.
- Map explorer UI: an OpenStreetMap base map (MapLibre GL JS) that loads the
  dataset catalog, draws the selected dataset's nodes and weighted edges, and
  shows details in a side panel and on click.
- Stub API endpoints `GET /api/datasets` and `GET /api/datasets/[id]`, serving
  sample data.
- Changelog.
- Data contract types in `lib/types.ts` and documentation in
  `docs/data-contract.md`, describing the shape of data passed from the
  pipeline, through the API, to the frontend (#1).
- Next.js app scaffold (Next.js 16, React 19, TypeScript, Tailwind CSS 4,
  ESLint).
