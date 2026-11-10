[English](README.md) | **Português (Brasil)**

# GeoNavi

O GeoNavi é um aplicativo web para explorar dados de fluxos geográficos em um mapa interativo. Você envia um arquivo com locais e o deslocamento entre eles (por exemplo, quantas pessoas se deslocam de um bairro para outro para trabalhar), e o GeoNavi desenha os pontos e os fluxos para você explorar.

O projeto foi desenvolvido para a disciplina de Projeto Final (Senior Design, CIS 4914, outono de 2026) da Universidade da Flórida, com orientação do Dr. Hu. O principal conjunto de dados de teste vem do CTPP (Census Transportation Planning Products, dados do censo dos EUA sobre deslocamentos): fluxos de deslocamento casa-trabalho entre setores censitários da Flórida, com cerca de 8.000 setores e 220.000 fluxos.

**Site:** https://geo-navi2026.vercel.app

## Funcionalidades

- **Envie um arquivo e veja no mapa.** Arraste e solte um arquivo ou use "Escolher arquivo". Os pontos aparecem como círculos e os fluxos como linhas. Linhas mais grossas indicam fluxos maiores.
- **Vários formatos de arquivo.** CSV, JSON, GeoJSON, GeoParquet, KML, GPX e shapefiles compactados em .zip. Veja [Formatos suportados](#formatos-suportados).
- **Seus dados ficam no seu computador.** Os arquivos são processados no navegador com DuckDB WASM. Nada é enviado para um servidor.
- **Estilo por coluna.** Cada coluna na barra lateral tem um menu Estilo. Uma coluna pode definir a cor, o tamanho ou a forma dos pontos, ou a cor e a espessura dos fluxos. Os fluxos mostram setas com a direção. Uma legenda explica os estilos.
- **Barra de filtro.** A barra na parte de baixo do mapa percorre os valores de qualquer coluna escolhida (horas do dia, faixas de números ou categorias) e mostra só os pontos ou fluxos correspondentes. Ela começa em uma coluna de tempo quando os dados têm uma. Use **Um** para escolher um único valor ou **Vários** para selecionar um intervalo, e aperte play para animar.
- **Inglês e português.** Troque o idioma da interface no botão EN / PT no canto superior direito.
- **Troque os dados sem sair do mapa.** Use "Novo arquivo" ou solte um novo arquivo em qualquer lugar do mapa.
- **Conjunto de dados de exemplo.** O botão "Usar os dados de exemplo" na tela inicial carrega dados de exemplo, para testar o aplicativo sem precisar de um arquivo.

## Formatos suportados

| Formato | Extensão | Observações |
| --- | --- | --- |
| CSV de fluxos | `.csv` | Precisa de colunas de latitude e longitude para a origem e o destino. Os nomes são reconhecidos em português ou inglês, por exemplo `latitude_origem`, `lat_destino`, `O_lat` ou `origin_lat`. Colunas de identificação da origem/destino (`origem`, `zona_destino`, `Otract`, …) e de tamanho do fluxo (`viagens`, `fluxo`, `EST`, `weight`, …) são opcionais. Funciona com vírgula ou ponto e vírgula como separador, e com ponto ou vírgula decimal (`-23,55`). Uma coluna chamada `hora`, `time` ou `hour` faz a barra de filtro começar pelas horas do dia. |
| JSON do GeoNavi | `.json` | Nosso formato próprio, com `nodes` e `edges`. Veja [docs/data-contract.md](docs/data-contract.md). |
| GeoJSON | `.geojson`, `.json` | Feições do tipo Point e LineString. As linhas podem ter as propriedades `source`, `target` e `weight`. |
| GeoParquet | `.parquet`, `.geoparquet` | Geometria WKB em WGS 84 (latitude e longitude). |
| KML | `.kml` | Placemarks com pontos e linhas. |
| GPX | `.gpx` | Waypoints, trilhas (tracks) e rotas. |
| Shapefile | `.zip` | Envie o próprio .zip, não os arquivos de dentro dele. Ele precisa ter pelo menos `.shp` e `.dbf`. Inclua `.shx` e `.prj` se tiver. |

**Limites:**
- Arquivos de até 50 MB.
- Apenas pontos e linhas. Dados de polígonos (áreas) não são suportados.
- As coordenadas precisam estar em latitude e longitude (WGS 84).

## Arquivos de exemplo

Os arquivos de teste ficam em [`data/test/`](data/test/):

| Arquivo | Conteúdo |
| --- | --- |
| `flow_demo.json`, `flow_demo.geojson`, `flow_demo.parquet` | Alguns setores de Gainesville e os fluxos entre eles, em três formatos |
| `flows_hourly.csv` | Fluxos com uma coluna `time`, para testar a barra de filtro |
| `sao_paulo_viagens.csv` | Fluxos fictícios de deslocamento entre distritos de São Paulo, no formato brasileiro (ponto e vírgula, vírgula decimal e colunas em português) |
| `tracts_demo.geojson` | Apenas pontos (sem fluxos), com colunas de população, renda e uso do solo para testar os estilos |

## Como rodar localmente

Você precisa do [Node.js](https://nodejs.org) 20 ou mais recente.

```bash
git clone https://github.com/GeoNavi2026/GeoNavi2026.git
cd GeoNavi2026
npm install
npm run dev
```

Depois abra http://localhost:3000.

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm run build` | Gera a versão de produção |
| `npm start` | Roda a versão de produção |
| `npm run lint` | Verifica o código com o ESLint |

## Como funciona

1. **Envio.** O navegador lê o arquivo. CSV, JSON e GeoParquet são lidos com DuckDB WASM. KML e GPX usam `@tmcw/togeojson`, e shapefiles usam `shpjs`.
2. **Conversão.** Todos os formatos são convertidos para uma mesma estrutura: uma lista de **nodes** (pontos) e **edges** (fluxos entre pontos). Os tipos ficam em `lib/types.ts`.
3. **Desenho.** O MapLibre GL desenha os pontos e os fluxos sobre um mapa base do OpenStreetMap.

## Estrutura do projeto

| Caminho | Conteúdo |
| --- | --- |
| `app/` | Páginas: tela de envio (`/`), mapa (`/explore`) e catálogo de dados (`/catalog`) |
| `app/components/` | Componentes da interface (mapa, barra lateral, legenda, barra de filtro, seletor de idioma) |
| `app/api/datasets/` | API que lista e serve os conjuntos de dados salvos em `data/datasets/` |
| `lib/process-upload.ts` | Lê todos os formatos de envio e converte para pontos e fluxos |
| `lib/csv-columns.ts` | Encontra as colunas de fluxo em um CSV (nomes em português ou inglês) e lê números nos dois formatos |
| `lib/types.ts` | Contrato de dados compartilhado pelo leitor de arquivos, pela API e pelo mapa |
| `lib/point-style.ts`, `lib/filter-axis.ts` | Lógica de estilos por coluna e da barra de filtro |
| `lib/i18n.tsx` | Textos da interface em inglês e português |
| `docs/data-contract.md` | Documentação do formato de dados (em inglês) |
| `data/test/` | Arquivos de exemplo |

## API

| Endpoint | Retorna |
| --- | --- |
| `GET /api/datasets` | Lista dos conjuntos de dados disponíveis |
| `GET /api/datasets/[id]` | Um conjunto de dados com seus pontos e fluxos |

## Limitações conhecidas

- Os nomes das colunas dos arquivos enviados aparecem como estão, sem tradução.
- Dados de polígonos não são suportados.
- Os dados enviados não são salvos. Recarregar a página apaga tudo.

## Equipe

Universidade da Flórida, CIS 4914 Projeto Final (Senior Design), outono de 2026

- Amogh Allani
- Ryan Feldbush
- Tyler Pencinger
- Zach Pinet

Orientador: Dr. Hu
