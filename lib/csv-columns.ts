// Flow CSV columns: find origin / destination / weight / coordinates by name,
// in English or Portuguese, and read numbers written either way (1,234.5 or 1.234,5).

export type FlowColumns = {
  origin: string | null; // optional, ids come from coordinates when missing
  destination: string | null;
  weight: string | null; // optional, each row counts as 1 when missing
  originLat: string;
  originLon: string;
  destinationLat: string;
  destinationLon: string;
};

const ORIGIN = ["o", "orig", "origin", "origem", "from", "source", "src", "start", "inicio", "partida", "saida"];
const DESTINATION = ["d", "dest", "destination", "destino", "to", "target", "end", "fim", "chegada"];
const LAT = ["lat", "latitude", "y"];
const LON = ["lon", "lng", "long", "longitude", "x"];
const ID_EXTRA = ["id", "tract", "zone", "zona", "code", "codigo", "cod", "name", "nome", "municipio", "setor", "bairro", "cidade"];

const WEIGHT = [
  "est", "weight", "count", "flow", "flows", "trips", "total", "value", "volume", "n",
  "peso", "valor", "fluxo", "fluxos", "viagens", "quantidade", "qtd", "qtde", "contagem", "total_viagens",
];

// "Latitude_Origem" -> ["latitude", "origem"], "originLat" -> ["origin", "lat"]
function tokens(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const has = (words: string[], set: string[]) => words.some((w) => set.includes(w));

function findCoordinate(names: string[], side: string[], axis: string[]) {
  // CTPP style first: O_lat, D_lon
  return names.find((name) => {
    const t = tokens(name);
    return has(t, side) && has(t, axis);
  }) ?? null;
}

function findId(names: string[], side: string[], exact: string[]) {
  const direct = names.find((name) => exact.includes(name.toLowerCase()));
  if (direct) return direct;

  return names.find((name) => {
    const t = tokens(name);
    if (has(t, LAT) || has(t, LON)) return false;
    return has(t, side) && (t.length === 1 || has(t, ID_EXTRA));
  }) ?? null;
}

export function findFlowColumns(names: string[]): FlowColumns | { missing: string[] } {
  const originLat = findCoordinate(names, ORIGIN, LAT);
  const originLon = findCoordinate(names, ORIGIN, LON);
  const destinationLat = findCoordinate(names, DESTINATION, LAT);
  const destinationLon = findCoordinate(names, DESTINATION, LON);

  const missing = [
    !originLat && "origin latitude",
    !originLon && "origin longitude",
    !destinationLat && "destination latitude",
    !destinationLon && "destination longitude",
  ].filter((x): x is string => Boolean(x));
  if (missing.length) return { missing };

  const weight = names.find((name) => WEIGHT.includes(tokens(name).join("_"))) ?? null;

  return {
    origin: findId(names, ORIGIN, ["otract"]),
    destination: findId(names, DESTINATION, ["dtract"]),
    weight,
    originLat: originLat!,
    originLon: originLon!,
    destinationLat: destinationLat!,
    destinationLon: destinationLon!,
  };
}

/** "1,234.5", "1.234,5", "-23,55" and "1234" all read as numbers; anything else is null. */
export function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;

  let s = raw.trim().replace(/\s/g, "");
  if (!s) return null;

  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  if (comma > dot) {
    s = s.replace(/\./g, "").replace(",", "."); // 1.234,5
  } else if (comma !== -1) {
    s = s.replace(/,/g, ""); // 1,234.5
  } else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, ""); // 1.234.567
  }

  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
