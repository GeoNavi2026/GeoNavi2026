import type { Geometry, LineString, MultiLineString, MultiPoint, Point } from "geojson";

class WkbReader {
  private offset = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private readUint32(littleEndian: boolean) {
    const value = this.view.getUint32(this.offset, littleEndian);
    this.offset += 4;
    return value;
  }

  private readCoordinate(littleEndian: boolean, dimensions: number): [number, number] {
    const longitude = this.view.getFloat64(this.offset, littleEndian);
    const latitude = this.view.getFloat64(this.offset + 8, littleEndian);
    this.offset += dimensions * 8;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new Error("GeoParquet geometry contains invalid coordinates.");
    }
    return [longitude, latitude];
  }

  readGeometry(): Geometry {
    if (this.offset + 5 > this.bytes.length) throw new Error("GeoParquet geometry has truncated WKB.");
    const byteOrder = this.bytes[this.offset++];
    if (byteOrder !== 0 && byteOrder !== 1) throw new Error("GeoParquet geometry has an invalid WKB byte order.");
    const littleEndian = byteOrder === 1;
    const encodedType = this.readUint32(littleEndian);
    const hasZFlag = (encodedType & 0x80000000) !== 0;
    const hasMFlag = (encodedType & 0x40000000) !== 0;
    const hasSrid = (encodedType & 0x20000000) !== 0;
    let type = encodedType & 0x1fffffff;
    let dimensions = 2 + Number(hasZFlag) + Number(hasMFlag);
    if (type >= 3000) {
      type -= 3000;
      dimensions = 4;
    } else if (type >= 2000) {
      type -= 2000;
      dimensions = 3;
    } else if (type >= 1000) {
      type -= 1000;
      dimensions = 3;
    }
    if (hasSrid) this.readUint32(littleEndian);

    if (type === 1) {
      const point: Point = { type: "Point", coordinates: this.readCoordinate(littleEndian, dimensions) };
      return point;
    }
    if (type === 2) {
      const count = this.readUint32(littleEndian);
      const coordinates: number[][] = [];
      for (let index = 0; index < count; index++) {
        coordinates.push(this.readCoordinate(littleEndian, dimensions));
      }
      const line: LineString = { type: "LineString", coordinates };
      return line;
    }
    if (type === 4) {
      const count = this.readUint32(littleEndian);
      const coordinates: number[][] = [];
      for (let index = 0; index < count; index++) {
        const point = this.readGeometry();
        if (point.type !== "Point") throw new Error("Invalid GeoParquet MultiPoint WKB.");
        coordinates.push(point.coordinates);
      }
      const points: MultiPoint = { type: "MultiPoint", coordinates };
      return points;
    }
    if (type === 5) {
      const count = this.readUint32(littleEndian);
      const coordinates: number[][][] = [];
      for (let index = 0; index < count; index++) {
        const line = this.readGeometry();
        if (line.type !== "LineString") throw new Error("Invalid GeoParquet MultiLineString WKB.");
        coordinates.push(line.coordinates);
      }
      const lines: MultiLineString = { type: "MultiLineString", coordinates };
      return lines;
    }
    throw new Error(
      `GeoParquet geometry type ${type} is not supported. Upload point or line features; polygon display is not supported yet.`
    );
  }

  isComplete() {
    return this.offset === this.bytes.length;
  }
}

export function parseWkbHex(value: string): Geometry {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("GeoParquet geometry is not valid WKB.");
  const bytes = Uint8Array.from(value.match(/.{2}/g)!, (pair) => Number.parseInt(pair, 16));
  const reader = new WkbReader(bytes);
  const geometry = reader.readGeometry();
  if (!reader.isComplete()) throw new Error("GeoParquet geometry has trailing WKB data.");
  return geometry;
}
