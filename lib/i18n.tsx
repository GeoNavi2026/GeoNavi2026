"use client";

// UI language (en / pt-BR)

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "pt-BR";

export const LANGS: { code: Lang; short: string; name: string }[] = [
  { code: "en", short: "EN", name: "English" },
  { code: "pt-BR", short: "PT", name: "Português" },
];

const STORAGE_KEY = "geonavi-lang";

type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

const one = (n: string, singular: string, many: string) => (n === "1" ? singular : many);

// lib/ messages, matched on the English text
const PT_MESSAGES: [RegExp, (...groups: string[]) => string][] = [
  // style hints
  [/^Points only$/, () => "Somente pontos"],
  [/^No values on points$/, () => "Sem valores nos pontos"],
  [/^Sunset ramp, low to high$/, () => "Degradê laranja, do menor para o maior"],
  [/^Rainbow, one colou?r per value$/, () => "Arco-íris, uma cor por valor"],
  [/^Colorblind-safe, one colou?r per value$/, () => "Seguro para daltônicos, uma cor por valor"],
  [/^Bigger points for bigger values$/, () => "Pontos maiores para valores maiores"],
  [/^Number columns only$/, () => "Somente colunas numéricas"],
  [/^Too many unique values \((.+)\)$/, (n) => `Valores únicos demais (${n})`],
  [
    /^([\d,.]+) unique values? → ([\d,.]+) shapes?$/,
    (n, s) => `${n} ${one(n, "valor único", "valores únicos")} → ${s} ${one(s, "forma", "formas")}`,
  ],
  [/^No values$/, () => "Sem valores"],
  [/^Needs at least 2 values$/, () => "Precisa de pelo menos 2 valores"],
  [/^Step through the 24 hours$/, () => "Percorre as 24 horas"],
  [/^(\d+) steps across the range$/, (n) => `${n} etapas ao longo do intervalo`],
  [/^(\d+) steps, one per value$/, (n) => `${n} etapas, uma por valor`],

  // upload errors
  [
    /^Unsupported file type\./,
    () => "Tipo de arquivo não suportado. Escolha CSV, JSON, GeoJSON, GeoParquet, KML, GPX ou um shapefile em .zip.",
  ],
  [/^CSV is missing required flow columns: (.+)\.$/, (cols) => `O CSV não tem as colunas de fluxo obrigatórias: ${cols}.`],
  [/^Could not parse (KML|GPX) XML\.$/, (format) => `Não foi possível ler o XML do arquivo ${format}.`],
  [
    /^The file contains no supported point or line features\./,
    () => "O arquivo não tem pontos ou linhas suportados. Polígonos ainda não são suportados.",
  ],
  [/^The ZIP archive does not contain a readable shapefile\.$/, () => "O arquivo .zip não contém um shapefile legível."],
  [
    /^JSON must be a GeoNavi dataset or a GeoJSON FeatureCollection\.$/,
    () => "O JSON precisa ser um conjunto de dados do GeoNavi ou uma FeatureCollection GeoJSON.",
  ],
  [/^GeoParquet uploads must use WGS 84 (.+)\.$/, (crs) => `Arquivos GeoParquet precisam usar WGS 84 ${crs}.`],
  [/^The input has no point coordinates\.$/, () => "O arquivo não tem coordenadas de pontos."],
];

export function translateMessage(message: string, lang: Lang): string {
  if (lang === "en") return message;

  for (const [pattern, render] of PT_MESSAGES) {
    const match = pattern.exec(message);
    if (match) return render(...match.slice(1));
  }
  return message; // no translation yet
}

// "6:00 PM" -> "18:00", "6 PM" -> "18h"
export function translateTimeLabel(label: string, lang: Lang): string {
  if (lang === "en") return label;
  const match = /^(\d{1,2})(:00)? (AM|PM)$/.exec(label);
  if (!match) return label;

  const hour = (Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0);
  return match[2] ? `${String(hour).padStart(2, "0")}:00` : `${hour}h`;
}

const en = {
  "lang.label": "Language",

  "upload.tagline": "Upload flow data and explore it on an interactive map.",
  "upload.drop": "Drag and drop your data file here",
  "upload.or": "or",
  "upload.browse": "Browse files",
  "upload.formats": "CSV, GeoJSON, GeoParquet, KML, GPX or zipped shapefile · up to 50 MB",
  "upload.noFile": "Don't have a file?",
  "upload.sample": "Try the sample dataset",
  "upload.processing": "Processing {name}…",
  "upload.loadingSample": "Loading the sample dataset…",
  "upload.tooLarge": "That file is larger than 50 MB.",

  "map.newUpload": "New upload",
  "map.rows.one": "{n} row",
  "map.rows.other": "{n} rows",
  "map.columns.one": "{n} column",
  "map.columns.other": "{n} columns",
  "map.columnsHeading": "Columns",
  "map.columnsHint": "Pick a style next to a column to drive the points",
  "map.dropReplace": "Drop to replace the current data",
  "map.zoomIn": "Zoom in",
  "map.zoomOut": "Zoom out",
  "map.weight": "Weight",
  "map.contributors": "contributors",

  "column.kind.text": "text",
  "column.kind.number": "number",
  "column.kind.lat": "lat",
  "column.kind.lon": "lon",
  "column.kind.time": "time",

  "style.color": "Color",
  "style.size": "Size",
  "style.shape": "Shape",
  "style.time": "Time",
  "style.style": "Style",
  "style.none": "none",
  "style.noStyle": "No style",
  "style.noStyleHint": "Points keep the default look",
  "style.position": "Position",
  "style.positionTitle": "Places the points on the map",
  "style.flows": "Flows",
  "style.flowsTitle": "These values are on flows, not points",
  "style.triggerLabel": "Style for {column}: {channel}",
  "style.menuLabel": "Style {column}",
  "style.colorSettings": "Color settings…",
  "style.colorSettingsLabel": "Color settings for {column}",
  "style.close": "Close",
  "style.scale": "Scale",
  "style.scale.linear": "Linear",
  "style.scale.quantile": "Quantile",
  "style.scale.log": "Log",
  "style.reverse": "Reverse colours",
  "style.done": "Done",

  "legend.label": "Legend",

  "slider.play": "Play",
  "slider.pause": "Pause",
  "slider.heading": "TIME",
  "slider.label": "Time: {column}",
} as const;

export type MessageKey = keyof typeof en;

const ptBR: Record<MessageKey, string> = {
  "lang.label": "Idioma",

  "upload.tagline": "Envie dados de fluxos e explore-os em um mapa interativo.",
  "upload.drop": "Arraste e solte seu arquivo de dados aqui",
  "upload.or": "ou",
  "upload.browse": "Escolher arquivo",
  "upload.formats": "CSV, GeoJSON, GeoParquet, KML, GPX ou shapefile em .zip · até 50 MB",
  "upload.noFile": "Não tem um arquivo?",
  "upload.sample": "Usar os dados de exemplo",
  "upload.processing": "Processando {name}…",
  "upload.loadingSample": "Carregando os dados de exemplo…",
  "upload.tooLarge": "O arquivo tem mais de 50 MB.",

  "map.newUpload": "Novo arquivo",
  "map.rows.one": "{n} linha",
  "map.rows.other": "{n} linhas",
  "map.columns.one": "{n} coluna",
  "map.columns.other": "{n} colunas",
  "map.columnsHeading": "Colunas",
  "map.columnsHint": "Escolha um estilo ao lado de uma coluna para definir os pontos",
  "map.dropReplace": "Solte para substituir os dados atuais",
  "map.zoomIn": "Aproximar",
  "map.zoomOut": "Afastar",
  "map.weight": "Peso",
  "map.contributors": "colaboradores",

  "column.kind.text": "texto",
  "column.kind.number": "número",
  "column.kind.lat": "lat",
  "column.kind.lon": "lon",
  "column.kind.time": "tempo",

  "style.color": "Cor",
  "style.size": "Tamanho",
  "style.shape": "Forma",
  "style.time": "Tempo",
  "style.style": "Estilo",
  "style.none": "nenhum",
  "style.noStyle": "Sem estilo",
  "style.noStyleHint": "Os pontos mantêm a aparência padrão",
  "style.position": "Posição",
  "style.positionTitle": "Posiciona os pontos no mapa",
  "style.flows": "Fluxos",
  "style.flowsTitle": "Estes valores estão nos fluxos, não nos pontos",
  "style.triggerLabel": "Estilo de {column}: {channel}",
  "style.menuLabel": "Estilo de {column}",
  "style.colorSettings": "Configurações de cor…",
  "style.colorSettingsLabel": "Configurações de cor de {column}",
  "style.close": "Fechar",
  "style.scale": "Escala",
  "style.scale.linear": "Linear",
  "style.scale.quantile": "Quantil",
  "style.scale.log": "Log",
  "style.reverse": "Inverter cores",
  "style.done": "Concluir",

  "legend.label": "Legenda",

  "slider.play": "Reproduzir",
  "slider.pause": "Pausar",
  "slider.heading": "TEMPO",
  "slider.label": "Tempo: {column}",
};

const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { en, "pt-BR": ptBR };

type I18n = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  plural: (count: number, key: "map.rows" | "map.columns") => string;
  formatNumber: (n: number) => string;
  translateMessage: (message: string) => string;
  translateTimeLabel: (label: string) => string;
};

const I18nContext = createContext<I18n | null>(null);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>.");
  return ctx;
}

function savedLang(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "en" || value === "pt-BR" ? value : null;
  } catch {
    return null;
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en"); // matches server render

  useEffect(() => {
    const browserPt = navigator.language.toLowerCase().startsWith("pt");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync after hydration
    setLangState(savedLang() ?? (browserPt ? "pt-BR" : "en"));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = DICTIONARIES[lang];
    const formatNumber = (n: number) => n.toLocaleString(lang === "pt-BR" ? "pt-BR" : "en-US");

    return {
      lang,
      setLang,
      formatNumber,
      t: (key, vars) => fill(dict[key], vars),
      plural: (count, key) => fill(dict[`${key}.${count === 1 ? "one" : "other"}`], { n: formatNumber(count) }),
      translateMessage: (message) => translateMessage(message, lang),
      translateTimeLabel: (label) => translateTimeLabel(label, lang),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
