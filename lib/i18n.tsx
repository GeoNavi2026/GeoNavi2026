"use client";

// UI language (en / pt-BR)

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  formatAxisLabel,
  formatAxisSpan,
  formatNumber,
  formatValue,
  pluralCategory,
  type AxisLabel,
  type Hint,
  type Lang,
} from "./format";

export type { Lang };

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

// Upload errors arrive from the processing pipeline as English text; match them here.
const PT_MESSAGES: [RegExp, (...groups: string[]) => string][] = [
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

  "map.summary": "Map showing {points} and {flows}.",
  "map.points.one": "{n} point",
  "map.points.other": "{n} points",
  "map.flows.one": "{n} flow",
  "map.flows.other": "{n} flows",

  "column.kind.text": "text",
  "column.kind.number": "number",
  "column.kind.lat": "lat",
  "column.kind.lon": "lon",
  "column.kind.time": "time",

  "style.color": "Color",
  "style.size": "Size",
  "style.shape": "Shape",
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
  "slider.label": "Filter: {column}",

  "filter.heading": "FILTER",
  "filter.column": "Filter by column",
  "filter.none": "No filter",
  "filter.all": "All data",
  "filter.empty": "Pick a column to step through its values",
  "filter.mode": "Selection",
  "filter.one": "One",
  "filter.many": "Many",
  "filter.manyHint": "Drag to select a range. Ctrl/⌘-click to add or remove values.",
  "filter.selected.one": "{n} value",
  "filter.selected.other": "{n} values",

  "isolate.one": "Flows for {name}",
  "isolate.many.one": "Flows for {n} point",
  "isolate.many.other": "Flows for {n} points",
  "isolate.clear": "Show all flows (Esc)",

  // Style menu hints; `{n}` is formatted for the language. `.one`/`.other` pick the plural form.
  "hint.noValuesOnPoints": "No values on points",
  "hint.sunset": "Sunset ramp, low to high",
  "hint.rainbow": "Rainbow, one colour per value",
  "hint.colorblind": "Colorblind-safe, one colour per value",
  "hint.bigger": "Bigger points for bigger values",
  "hint.numbersOnly": "Number columns only",
  "hint.noValues": "No values",
  "hint.needsTwo": "Needs at least 2 values",
  "hint.hours": "Step through the 24 hours",
  "hint.tooMany": "Too many unique values ({n})",
  "hint.shapes.one": "{n} unique value → {n} shape",
  "hint.shapes.other": "{n} unique values → {n} shapes",
  "hint.rangeSteps": "{n} steps across the range",
  "hint.valueSteps": "{n} steps, one per value",
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
  "map.summary": "Mapa com {points} e {flows}.", // leitor de tela
  "map.points.one": "{n} ponto",
  "map.points.other": "{n} pontos",
  "map.flows.one": "{n} fluxo",
  "map.flows.other": "{n} fluxos",

  "column.kind.text": "texto",
  "column.kind.number": "número",
  "column.kind.lat": "lat",
  "column.kind.lon": "lon",
  "column.kind.time": "tempo",

  "style.color": "Cor",
  "style.size": "Tamanho",
  "style.shape": "Forma",
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
  "slider.label": "Filtro: {column}",

  "filter.heading": "FILTRO",
  "filter.column": "Filtrar por coluna",
  "filter.none": "Sem filtro",
  "filter.all": "Todos os dados",
  "filter.empty": "Escolha uma coluna para percorrer seus valores",
  "filter.mode": "Seleção",
  "filter.one": "Um",
  "filter.many": "Vários",
  "filter.manyHint": "Arraste para selecionar um intervalo. Ctrl/⌘ + clique para adicionar ou remover valores.",
  "filter.selected.one": "{n} valor",
  "filter.selected.other": "{n} valores",

  "isolate.one": "Fluxos de {name}",
  "isolate.many.one": "Fluxos de {n} ponto",
  "isolate.many.other": "Fluxos de {n} pontos",
  "isolate.clear": "Mostrar todos os fluxos (Esc)",

  "hint.noValuesOnPoints": "Sem valores nos pontos",
  "hint.sunset": "Degradê laranja, do menor para o maior",
  "hint.rainbow": "Arco-íris, uma cor por valor",
  "hint.colorblind": "Seguro para daltônicos, uma cor por valor",
  "hint.bigger": "Pontos maiores para valores maiores",
  "hint.numbersOnly": "Somente colunas numéricas",
  "hint.noValues": "Sem valores",
  "hint.needsTwo": "Precisa de pelo menos 2 valores",
  "hint.hours": "Percorre as 24 horas",
  "hint.tooMany": "Valores únicos demais ({n})",
  "hint.shapes.one": "{n} valor único → {n} forma",
  "hint.shapes.other": "{n} valores únicos → {n} formas",
  "hint.rangeSteps": "{n} etapas ao longo do intervalo",
  "hint.valueSteps": "{n} etapas, uma por valor",
};

const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { en, "pt-BR": ptBR };

type I18n = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  plural: (
    count: number,
    key: "map.rows" | "map.columns" | "map.points" | "map.flows" | "filter.selected" | "isolate.many"
  ) => string;
  /** Full number with grouping, e.g. a flow's weight. */
  formatNumber: (n: number) => string;
  /** Compact number for legends, e.g. "18K" / "18 mil". */
  formatValue: (n: number) => string;
  /** A filter step or tick. */
  formatAxisLabel: (label: AxisLabel) => string;
  /** A run of neighbouring filter steps. */
  formatAxisSpan: (first: AxisLabel, last: AxisLabel) => string;
  /** A style menu hint from lib/ code. */
  hint: (hint: Hint) => string;
  translateMessage: (message: string) => string;
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
    const number = (n: number) => formatNumber(n, lang);

    return {
      lang,
      setLang,
      formatNumber: number,
      formatValue: (n) => formatValue(n, lang),
      formatAxisLabel: (label) => formatAxisLabel(label, lang),
      formatAxisSpan: (first, last) => formatAxisSpan(first, last, lang),
      t: (key, vars) => fill(dict[key], vars),
      plural: (count, key) => fill(dict[`${key}.${pluralCategory(count, lang)}`], { n: number(count) }),
      hint: (hint) => {
        if (!("n" in hint)) return dict[`hint.${hint.key}`];
        const plural = `hint.${hint.key}.${pluralCategory(hint.n, lang)}`;
        const key = (plural in dict ? plural : `hint.${hint.key}`) as MessageKey;
        return fill(dict[key], { n: number(hint.n) });
      },
      translateMessage: (message) => translateMessage(message, lang),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
