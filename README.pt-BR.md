[English](README.md) | **Português (Brasil)**

# GeoNavi

O GeoNavi é um aplicativo web para explorar dados de fluxos geográficos em um mapa interativo. Você envia um arquivo com locais e o deslocamento entre eles (por exemplo, quantas pessoas se deslocam de um bairro para outro para trabalhar), e o GeoNavi desenha os pontos e os fluxos para você explorar.

O projeto foi desenvolvido para a disciplina de Projeto Final (Senior Design, CIS 4914, outono de 2026) da Universidade da Flórida, com orientação do Dr. Hu. O principal conjunto de dados de teste vem do CTPP (Census Transportation Planning Products, dados do censo dos EUA sobre deslocamentos): fluxos de deslocamento casa-trabalho entre setores censitários da Flórida, com cerca de 8.000 setores e 220.000 fluxos.

**Site:** https://geo-navi2026.vercel.app

## Funcionalidades

- **Envie um arquivo e veja no mapa.** Arraste e solte um arquivo ou use "Browse files". Os pontos aparecem como círculos e os fluxos como linhas. Linhas mais grossas indicam fluxos maiores.
- **Vários formatos de arquivo.** CSV, JSON, GeoJSON, GeoParquet, KML, GPX e shapefiles compactados em .zip. Veja [Formatos suportados](#formatos-suportados).
- **Seus dados ficam no seu computador.** Os arquivos são processados no navegador com DuckDB WASM. Nada é enviado para um servidor.
- **Estilo por coluna.** Cada coluna na barra lateral tem um menu Style. Uma coluna pode definir a cor, o tamanho ou a forma dos pontos. Uma legenda explica os estilos.
- **Controle de tempo.** Atribua uma coluna a Time e o controle deslizante percorre os valores dela (horas do dia, números ou categorias), mostrando só os pontos ou fluxos daquela etapa. Aperte play para animar.
- **Troque os dados sem sair do mapa.** Use "New upload" ou solte um novo arquivo em qualquer lugar do mapa.
- **Conjunto de dados de exemplo.** O botão "Try the sample dataset" na tela inicial carrega dados de exemplo, para testar o aplicativo sem precisar de um arquivo.

> A interface ainda está apenas em inglês, por isso os nomes dos botões aparecem em inglês acima. A tradução para o português está em andamento.

## Formatos suportados

| Formato | Extensão | Observações |
| --- | --- | --- |
| CSV de fluxos | `.csv` | Precisa das colunas `Otract`, `Dtract`, `EST`, `O_lat`, `O_lon`, `D_lat`, `D_lon` (origem, destino, tamanho do fluxo e coordenadas). Uma coluna chamada `time`, `hour` ou `timestamp` é usada pelo controle de tempo. |
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
| `flows_hourly.csv` | Fluxos com uma coluna `time`, para testar o controle de tempo |
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
| `app/components/` | Componentes da interface (mapa, barra lateral, legenda, controle de tempo) |
| `app/api/datasets/` | API que lista e serve os conjuntos de dados salvos em `data/datasets/` |
| `lib/process-upload.ts` | Lê todos os formatos de envio e converte para pontos e fluxos |
| `lib/types.ts` | Contrato de dados compartilhado pelo leitor de arquivos, pela API e pelo mapa |
| `lib/point-style.ts`, `lib/time-axis.ts` | Lógica de estilos por coluna e do controle de tempo |
| `docs/data-contract.md` | Documentação do formato de dados (em inglês) |
| `data/test/` | Arquivos de exemplo |

## API

| Endpoint | Retorna |
| --- | --- |
| `GET /api/datasets` | Lista dos conjuntos de dados disponíveis |
| `GET /api/datasets/[id]` | Um conjunto de dados com seus pontos e fluxos |

## Limitações conhecidas

- Por enquanto a interface está apenas em inglês. A tradução para o português está em andamento.
- Dados de polígonos não são suportados.
- Os dados enviados não são salvos. Recarregar a página apaga tudo.

## Equipe

Universidade da Flórida, CIS 4914 Projeto Final (Senior Design), outono de 2026

- Amogh Allani
- Ryan Feldbush
- Tyler Pencinger
- Zach Pinet

Orientador: Dr. Hu
