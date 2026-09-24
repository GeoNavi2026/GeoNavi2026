# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
  - Added a CSV-to-GeoJSON dataset build test using Census-style tract IDs (`scripts/build-dataset.ts`),
  including dummy origin/destination flow data, tract centroid coordinates, validation,
  and generated map-ready GeoJSON output.
