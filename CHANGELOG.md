# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Time is no longer a style option. The bar at the bottom of the map is now an
  always-visible filter bar with a column picker: it steps through the values
  of the picked column (hours for time columns, values or ranges for numbers,
  distinct values for text) and shows only the matching points or flows. It
  starts on a time column when the data has one, otherwise on "No filter".
- Points outside the filter's current step are faded instead of hidden.
- CSV flow files keep their origin, destination and weight columns (`Otract`,
  `Dtract`, `EST`, …) on the flows, so they can drive the filter bar and flow
  styles.
- Long whole-number columns such as tract ids are treated as categories: one
  colour or filter step per id, and no Size or Width.
- Color by category is unavailable for columns with more than 100 distinct
  values, where neighbouring colours become indistinguishable.
- The filter bar has a One/Many mode. In Many, drag across the bars to select
  a range, Ctrl/⌘-click to add or remove single values and Shift-click to
  extend; Play slides the whole selection.

### Fixed

- Point names no longer draw on top of the filter bar and other map overlays.
- GeoParquet flow columns (`source`, `target`, `weight`) are treated as flow
  columns: points from the same table carry them as empty values, which made
  them look like point columns with no values.
- Long whole-number ids such as tract ids show in full on the filter bar
  ("12001000201") instead of compacted to "12B".
- The time slider supports click-and-drag again: dragging the thumb used to
  start a native image drag (which could also trigger a bogus "Unsupported file
  type" upload). Dragging anywhere on the bars or track now scrubs.
- Number labels keep full values below 10,000, so years read "2019" instead of
  "2K".
- Coordinate columns like `xlong`/`ylat` are recognised, and names such as
  `flat` or `nylon` are no longer mistaken for coordinates.
- The legend's scrollbar uses the dark theme.

### Added

- Flows show their direction: an arrowhead halfway along each flow, in the
  flow's colour. Arrows are drawn while at most 10,000 flows are shown, so on
  big datasets they appear once the filter bar or isolation narrows the flows.
- Flow styling: columns on flows get a Style menu with Color (blue ramp for
  numbers, one colour per value otherwise, same scale and reverse settings as
  points) and Width (numbers only). Both appear in the legend as "Flow color"
  and "Flow width".
- Double-clicking a point (within a few pixels, or on its name) isolates its
  flows: only flows starting or ending there stay on the map and unconnected
  points fade (their names dim but stay double-clickable). Ctrl/⌘-double-click adds or removes more points. A chip at the
  top left names the isolated points; its ×, Esc or double-clicking the point
  again shows every flow. Works alongside the filter bar.
- "Time" style option: assigning a column to Time brings up the time slider,
  which steps through that column's values and shows only the points or flows
  at the current step. Time columns step through the 24 hours, number columns
  through each value (or 24 even ranges), text columns through each distinct
  value (up to 100). Works on flow columns too; the slider no longer appears
  automatically. Adds `data/test/flows_hourly.csv` for trying it.
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
