# caladapt-stac-map

A map-first way to explore the Cal-Adapt STAC catalog, written for planners, light researchers and the general public rather than STAC experts.

It has three modes:

- **Year by year** draws LOCA2 gridded projections on the map using CalAdapt-Tiler. Users pick a measure (hottest day of the year, monthly highs and lows, precipitation, and so on), an emissions scenario and a climate model, then scrub or play through 1950–2100. Clicking the map shows the value at that spot.
- **Warming levels** shows the multi-model WRF metrics from the Cal-Adapt Climate Metrics Map (extreme heat days, warm nights, extreme precipitation, fire weather) at 0.8–3.0 °C of global warming, with the range across the 4 models when you click. Metric definitions, ranges and colors mirror `cal-adapt-de-website/src/data/climate-metrics-map/metrics.ts`.
- **Data for a place** shows counties or weather stations. Clicking one lists the matching STAC items with plain-language filters and download links (NetCDF), or a Python snippet for opening Zarr stores.

## Running locally

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

Requires Node 18+. API endpoints come from environment variables (see `.env.example`). By default the app uses `https://stac.cal-adapt.org` and `https://map.cal-adapt.org`.

Each map mode has a **Get this data** section with copyable code for whatever is on screen (xarray, climakitae, pystac-client, AWS CLI), and terms like "global warming level" open their definition from the Analytics Engine glossary.

## How it works

| File | Role |
|---|---|
| `src/config.ts` | All plain-language labels, color scales, unit conversions and dataset definitions. Start here to add a layer or dataset. |
| `src/stac.ts` | STAC search (follows `next` links, leaves out geometry) and tiler URL helpers |
| `src/useClimate.ts` | Gridded layer state: loads LOCA2 items for a variable, picks the item for model, scenario and year, and builds the tile URL |
| `src/usePlaces.ts` | Place datasets: loads each collection's `item-geometries` asset for the map, then searches items for the selected place |
| `src/useWarming.ts` | Warming-level layer state: reads the levels from the store, builds tiles, reads mean/min/max at a clicked point |
| `src/colormap.ts` | Color tables sent to the tiler and drawn in the legend (ported from cal-adapt-de-website, so colors match) |
| `src/snippets.ts` | The "Get this data" code for each layer |
| `src/data/glossary.json` | Copy of the guidance glossary. Refresh with `node scripts/sync-glossary.mjs ../cal-adapt-guidance` |
| `src/components/MapView.tsx` | MapLibre map with the raster layer, place layers and the value popup |

### Catalog conventions the app relies on

- Place collections publish an `item-geometries` collection asset (unique geometries as GeoJSON), so the map never pages through thousands of items.
- Before 2015 the app uses the `historical` experiment, and from 2015 on it uses the chosen SSP. One slider covers both periods.
- When a model has several ensemble members, the app shows `r1i1p1f1` if it exists, otherwise the lowest-numbered member.
- Searches send `fields: {exclude: ["geometry"]}`. Without it, a single county's 112 items take more than 16 s and time out. With it, they take about 1 s.

## Known gaps and notes for a future tiler

- **Tiles take about 1 s each.** The slider waits until it settles before requesting tiles, and "play" steps every 1.5 s.
- **Single model, single year only.** The public will probably want multi-model averages and "change from historical" maps. These need either pre-computed layers or new tiler endpoints.
- **`/statistics` mislabels times.** It does apply `datetime` (the means differ for 2015 and 2090), but the result is always keyed by the first timestamp, because `ZarrReader.band_names` reads the unselected time coordinate.
- **Data extends beyond California** (the LOCA2 domain covers parts of NV, AZ and OR). The tiler could clip to the state boundary.
- **Warming-level data not in STAC.** The extreme heat days and warm nights stores (`wrf/extreme-heat-tool/multimodel_gridded/`) aren't in the catalog, so the app (like the website) uses their S3 paths directly.
- **`wrf-climate-metrics-map` data issues:** the `mm4q25`/`mm4q75` stores for `t2max_99pctl`, `t2max_ge100F` and `t2max_ge105F` are missing the `Lambert_Conformal` coordinate, so the tiler can't read them; those three metrics are also labeled `units='K'`, "daily maximum 2-m temperature", although `t2max_ge*` hold day counts. The app doesn't show them.
- **HadISD station names are cut off at 29 characters** in `hadisd-wecc-station-coords.geojson`.
- Not yet shown: the WRF boundary-CSV tools and `pv-generation`. The footer links to STAC Browser for those.
