# Data Contract

Shape of the data passed from the pipeline, through the API, to the frontend.
Types live in `lib/types.ts` and are the source of truth.

## Endpoints

| Endpoint | Returns |
| --- | --- |
| `GET /api/datasets` | `DatasetMeta[]` � catalog listing |
| `GET /api/datasets/[id]` | `DatasetResponse` � one dataset with nodes and edges |

## Example

```json
{
  "meta": {
    "id": "gnv-commute",
    "name": "Gainesville Commute Flows",
    "description": "Home-to-work flows by census tract.",
    "source": "Census Transportation Planning Products",
    "region": "Gainesville, FL",
    "temporal": false,
    "nodeCount": 2,
    "edgeCount": 1,
    "bbox": [-82.42, 29.61, -82.30, 29.69],
    "nodeColumns": [
      { "key": "population", "type": "number", "min": 1200, "max": 4500 }
    ],
    "edgeColumns": [
      { "key": "mode", "type": "string", "categories": ["car", "transit", "bike"] }
    ]
  },
  "nodes": [
    { "id": "n1", "coords": [-82.3248, 29.6516], "name": "Tract 1" },
    { "id": "n2", "coords": [-82.4102, 29.6789], "name": "Tract 2" }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2", "weight": 412 }
  ]
}
```

## Notes

- Coordinates are `[longitude, latitude]`, GeoJSON order.
- Edges reference node ids. Coordinates are never duplicated on edges.
- `t` is optional. Set `meta.temporal` to true when edges carry it.
- `properties` is a free-form bag for dataset-specific fields. Add to it
  rather than changing the core shape.
- `nodeColumns` and `edgeColumns` describe the property keys found in the
  dataset so the frontend can offer column-driven controls (e.g. pick which
  property maps to edge thickness or colour). They are auto-populated by the
  API when absent, so pipeline output does not need to include them.
- Any change to the core shape needs agreement from backend, pipeline, and
  frontend before it lands.
