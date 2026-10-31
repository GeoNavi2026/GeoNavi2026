declare module "shpjs" {
  import type { FeatureCollection, Geometry } from "geojson";

  type ShapefileCollection = FeatureCollection<Geometry>;

  function shp(
    input: ArrayBuffer | Uint8Array
  ): Promise<ShapefileCollection | Record<string, ShapefileCollection>>;

  export default shp;
}
