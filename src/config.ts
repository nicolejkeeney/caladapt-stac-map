// Everything that maps catalog terms to plain language lives here, so the
// rest of the app never shows raw STAC property names to users.

export const STAC_API = import.meta.env.VITE_STAC_API ?? "https://stac.cal-adapt.org";
export const TILER = import.meta.env.VITE_TILER ?? "https://map.cal-adapt.org";
// STAC Browser uses hash routing, so pages live under /#/ (e.g. /#/collections/loca2)
export const STAC_BROWSER = "https://stac-browser.cal-adapt.org/#";

export const CA_BOUNDS: [number, number, number, number] = [-124.6, 32.4, -114.0, 42.1];

// ---------- Gridded climate layers (LOCA2 via the tiler) ----------

export type Frequency = "yrmax" | "mon";

export interface Unit {
  label: string;
  convert: (raw: number) => number;
  digits: number;
}

export interface ClimateLayer {
  id: string;
  title: string;
  blurb: string;
  variable: string;
  frequency: Frequency;
  rescale: [number, number]; // in the file's native units
  colormap: string; // a name from colormap.ts; drives both tiles and legend
  bins?: number;
  unit: Unit;
  defaultMonth?: number; // 0-based; the month shown when this layer is picked
}

const kelvinToF: Unit = { label: "°F", convert: (k) => ((k - 273.15) * 9) / 5 + 32, digits: 0 };


export const CLIMATE_LAYERS: ClimateLayer[] = [
  {
    id: "hottest-day",
    title: "Hottest day of the year",
    blurb: "The single highest daily temperature reached each year.",
    variable: "tasmax",
    frequency: "yrmax",
    rescale: [285, 325],
    colormap: "RdYlBu_r",
    unit: kelvinToF,
  },
  {
    id: "daily-high",
    title: "Average daily high",
    blurb: "The typical afternoon high temperature for the month.",
    variable: "tasmax",
    frequency: "mon",
    rescale: [265, 320],
    colormap: "RdYlBu_r",
    unit: kelvinToF,
  },
  {
    id: "daily-low",
    title: "Average daily low",
    blurb: "The typical overnight low temperature for the month.",
    variable: "tasmin",
    frequency: "mon",
    rescale: [255, 305],
    colormap: "RdYlBu_r",
    unit: kelvinToF,
  },
  {
    id: "precip",
    title: "Precipitation",
    blurb: "Average rain and snow per day during the month.",
    variable: "pr",
    frequency: "mon",
    rescale: [0, 0.0002],
    colormap: "Blues",
    defaultMonth: 0, // summers in California are dry, so start in January
    // kg m-2 s-1 is mm/s; show inches per day
    unit: { label: "in/day", convert: (v) => (v * 86400) / 25.4, digits: 2 },
  },
  {
    id: "sunlight",
    title: "Sunlight",
    blurb: "Solar energy reaching the ground, averaged over the month.",
    variable: "rsds",
    frequency: "mon",
    rescale: [50, 350],
    colormap: "YlOrRd",
    unit: { label: "W/m²", convert: (v) => v, digits: 0 },
  },
  {
    id: "humidity",
    title: "Humidity (daily maximum)",
    blurb: "The most humid point of a typical day, usually early morning.",
    variable: "hursmax",
    frequency: "mon",
    rescale: [20, 100],
    colormap: "GnBu",
    unit: { label: "%", convert: (v) => v, digits: 0 },
  },
  {
    id: "wind",
    title: "Wind speed",
    blurb: "Average near-surface wind speed for the month.",
    variable: "wspeed",
    frequency: "mon",
    rescale: [0, 8],
    colormap: "viridis",
    unit: { label: "mph", convert: (v) => v * 2.237, digits: 1 },
  },
];

// The scenario is only meaningful from 2015 onward; earlier years come from
// the "historical" model runs.
export const FIRST_FUTURE_YEAR = 2015;

export const SCENARIOS: { id: string; title: string; ssp: string; blurb: string }[] = [
  { id: "ssp245", title: "Lower emissions", ssp: "SSP2-4.5", blurb: "Emissions peak mid-century, then decline (SSP2-4.5)." },
  { id: "ssp370", title: "Higher emissions", ssp: "SSP3-7.0", blurb: "Emissions keep rising through 2100 (SSP3-7.0)." },
  { id: "ssp585", title: "Very high emissions", ssp: "SSP5-8.5", blurb: "Fossil-fuel-heavy development (SSP5-8.5)." },
];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------- Warming levels ----------
// Mirrors cal-adapt-de-website's Climate Metrics Map (src/data/climate-metrics-map/metrics.ts)
// so the two tools show the same metrics, ranges and colors.

export const CALADAPT_SITE = "https://cal-adapt.org";
export const GUIDANCE_SITE = "https://analytics.cal-adapt.org";
export const WARMING_MODELS = ["EC-Earth3", "MIROC6", "MPI-ESM1-2-HR", "TaiESM1"];

export interface WarmingVariant {
  mean: string;
  min: string;
  max: string;
  variable: string;
  rescale: [number, number];
  colormap: string;
  bins?: number;
  description: string;
}

export interface WarmingLayer {
  id: string; // matches the website's metric slug
  title: string;
  blurb: string;
  unit: Unit;
  dataMethods: string; // path on the Cal-Adapt website
  stacCollection?: string; // when the stores are in the STAC catalog
  abs: WarmingVariant;
  del: WarmingVariant;
}

const EH = "s3://cadcat/wrf/extreme-heat-tool/multimodel_gridded";
const CMM = "s3://cadcat/wrf/climate-metrics-map";
const cmm = (stat: string, v: string) => `${CMM}/${stat}/ssp370/gwl/${v}/d03`;
const days: Unit = { label: "days", convert: (v) => v, digits: 0 };
const nights: Unit = { label: "nights", convert: (v) => v, digits: 0 };
const mmToIn: Unit = { label: "in", convert: (v) => v / 25.4, digits: 2 };

export const WARMING_LAYERS: WarmingLayer[] = [
  {
    id: "extreme-heat",
    title: "Extreme heat days",
    blurb: "Days per year when the high temperature reaches 95°F or hotter.",
    unit: days,
    dataMethods: "/dashboard/data-methods/extreme-heat-days",
    abs: {
      mean: `${EH}/eh_days/mm4mean/ssp370/gwl/t2max_ge95F/d03`,
      min: `${EH}/eh_days/mm4min/ssp370/gwl/t2max_ge95F/d03`,
      max: `${EH}/eh_days/mm4max/ssp370/gwl/t2max_ge95F/d03`,
      variable: "t2max_ge95F",
      rescale: [0, 120],
      colormap: "cal-adapt-extreme-heat",
      bins: 12,
      description: "Average number of days per year with a high of 95°F or more",
    },
    del: {
      mean: `${EH}/eh_days/mm4mean/ssp370/gwl_delta/t2max_ge95F/d03`,
      min: `${EH}/eh_days/mm4min/ssp370/gwl_delta/t2max_ge95F/d03`,
      max: `${EH}/eh_days/mm4max/ssp370/gwl_delta/t2max_ge95F/d03`,
      variable: "t2max_ge95F",
      rescale: [0, 50],
      colormap: "cal-adapt-extreme-heat",
      bins: 10,
      description: "Change in days per year with a high of 95°F or more, compared with a 0.8 °C world",
    },
  },
  {
    id: "warm-nights",
    title: "Warm nights",
    blurb: "Nights per year when the low temperature stays at 70°F or warmer.",
    unit: nights,
    dataMethods: "/dashboard/data-methods/extreme-heat-days",
    abs: {
      mean: `${EH}/warm_nights/mm4mean/ssp370/gwl/t2min_ge70F/d03`,
      min: `${EH}/warm_nights/mm4min/ssp370/gwl/t2min_ge70F/d03`,
      max: `${EH}/warm_nights/mm4max/ssp370/gwl/t2min_ge70F/d03`,
      variable: "t2min_ge70F",
      rescale: [0, 120],
      colormap: "cal-adapt-warm-nights",
      bins: 12,
      description: "Average number of nights per year with a low of 70°F or more",
    },
    del: {
      mean: `${EH}/warm_nights/mm4mean/ssp370/gwl_delta/t2min_ge70F/d03`,
      min: `${EH}/warm_nights/mm4min/ssp370/gwl_delta/t2min_ge70F/d03`,
      max: `${EH}/warm_nights/mm4max/ssp370/gwl_delta/t2min_ge70F/d03`,
      variable: "t2min_ge70F",
      rescale: [0, 50],
      colormap: "cal-adapt-warm-nights",
      bins: 10,
      description: "Change in nights per year with a low of 70°F or more, compared with a 0.8 °C world",
    },
  },
  {
    id: "extreme-precipitation",
    title: "Extreme precipitation",
    blurb: "How much rain or snow falls on the wettest 1% of days.",
    unit: mmToIn,
    dataMethods: "/dashboard/data-methods/extreme-precipitation",
    stacCollection: "wrf-climate-metrics-map",
    abs: {
      mean: cmm("mm4mean", "R99p"),
      min: cmm("mm4min", "R99p"),
      max: cmm("mm4max", "R99p"),
      variable: "R99p",
      rescale: [0, 265],
      colormap: "Blues",
      description: "Daily precipitation on the wettest 1% of days",
    },
    del: {
      mean: cmm("mm4mean", "R99pd"),
      min: cmm("mm4min", "R99pd"),
      max: cmm("mm4max", "R99pd"),
      variable: "R99pd",
      rescale: [-20, 20],
      colormap: "BrBG",
      description: "Change in daily precipitation on the wettest 1% of days, compared with a 0.8 °C world",
    },
  },
  {
    id: "fire-weather",
    title: "Fire weather",
    blurb: "Days per year when hot, dry, windy weather makes fires likely to spread (Fosberg Fire Weather Index of 50 or more).",
    unit: days,
    dataMethods: "/dashboard/data-methods/fire-weather",
    stacCollection: "wrf-climate-metrics-map",
    abs: {
      mean: cmm("mm4mean", "ffwige50"),
      min: cmm("mm4min", "ffwige50"),
      max: cmm("mm4max", "ffwige50"),
      variable: "ffwige50",
      rescale: [0, 365],
      colormap: "gist_heat_r",
      description: "Average number of days per year with a fire weather index of 50 or more",
    },
    del: {
      mean: cmm("mm4mean", "ffwige50d"),
      min: cmm("mm4min", "ffwige50d"),
      max: cmm("mm4max", "ffwige50d"),
      variable: "ffwige50d",
      rescale: [-2, 2],
      colormap: "PuOr_r",
      description: "Change in days per year with a fire weather index of 50 or more, compared with a 0.8 °C world",
    },
  },
];

// Official model names, as used by the Analytics Engine catalog and climakitae.
// STAC paths use the lowercase form.
export const MODEL_NAMES: Record<string, string> = Object.fromEntries(
  [
    "ACCESS-CM2", "CESM2-LENS", "CNRM-ESM2-1", "EC-Earth3", "EC-Earth3-Veg", "FGOALS-g3", "GFDL-ESM4",
    "HadGEM3-GC31-LL", "INM-CM5-0", "IPSL-CM6A-LR", "KACE-1-0-G", "MIROC6", "MPI-ESM1-2-HR", "MRI-ESM2-0", "TaiESM1",
  ].map((n) => [n.toLowerCase(), n]),
);

// ---------- Place-based datasets ----------

export type PlaceKind = "county" | "station";

export interface PlaceDataset {
  id: string;
  collection: string;
  kind: PlaceKind;
  // GeoJSON property that identifies a place, and how to find its items
  idProperty: string;
  nameProperty: string;
  match: { type: "property"; property: string } | { type: "itemId"; prefix: string };
  // Item properties to narrow a station's files by, in order (building and planning profiles)
  filters?: { property: string; label: string }[];
}

// The building and planning profiles share the same 33 stations
function profile(collection: string, filters: { property: string; label: string }[]): PlaceDataset {
  return {
    id: collection,
    collection,
    kind: "station",
    idProperty: "location",
    nameProperty: "station_name",
    match: { type: "property", property: "location" },
    filters,
  };
}

const TIME_PERIOD = { property: "time_period", label: "Time period" };
const MODEL = { property: "model", label: "Climate model" };
const PERCENTILE = { property: "percentile", label: "Percentile" };

export const PLACE_DATASETS: PlaceDataset[] = [
  {
    id: "counties",
    collection: "loca2-county",
    kind: "county",
    idProperty: "fips",
    nameProperty: "county_name",
    match: { type: "property", property: "county_code" },
  },
  {
    id: "hadisd",
    collection: "hadisd",
    kind: "station",
    idProperty: "station_id",
    nameProperty: "station_name",
    match: { type: "itemId", prefix: "hadisd-" },
  },
  {
    id: "hdp",
    collection: "historical-data-platform",
    kind: "station",
    idProperty: "era_id",
    nameProperty: "era_id",
    match: { type: "itemId", prefix: "" },
  },
  profile("typical-met-year", [TIME_PERIOD, MODEL]),
  profile("standard-year", [
    { property: "variable", label: "Variable" },
    TIME_PERIOD,
    { property: "centered_year", label: "Centered year" },
    PERCENTILE,
  ]),
  profile("xmy-persist", [TIME_PERIOD, MODEL, PERCENTILE]),
  profile("xmy-shock", [TIME_PERIOD, MODEL, { property: "shock_type", label: "Shock type" }]),
];

export const VARIABLE_NAMES: Record<string, string> = {
  tasmax: "Daily high temperature",
  tasmin: "Daily low temperature",
  pr: "Precipitation",
  huss: "Humidity (specific)",
  hursmax: "Humidity (daily max)",
  hursmin: "Humidity (daily min)",
  rsds: "Sunlight",
  uas: "Wind (east–west)",
  vas: "Wind (north–south)",
  wspeed: "Wind speed",
};

export const FREQUENCY_NAMES: Record<string, string> = {
  day: "Daily values",
  mon: "Monthly averages",
  yrmax: "Yearly maximum",
};

export const SCENARIO_NAMES: Record<string, string> = {
  historical: "Historical (1950–2014)",
  ...Object.fromEntries(SCENARIOS.map((s) => [s.id, `${s.title} (${s.ssp})`])),
};

// ---------- Catalog topics ----------

// Topic groupings for the Browse page. A collection can sit under more than one.
export const TOPICS: { id: string; title: string; collections: string[] }[] = [
  {
    id: "heat",
    title: "Temperature and heat",
    collections: [
      "eh-metrics-mm-boundary-csv", "ehs-metrics-mm-boundary-csv", "hwf-metrics-mm-boundary-csv", "hwl-metrics-mm-boundary-csv",
      "loca2", "loca2-county", "wrf-ucla", "wrf-derived-vars", "wrf-climate-metrics-map",
    ],
  },
  { id: "rain", title: "Rain and snow", collections: ["loca2", "loca2-county", "wrf-ucla", "wrf-derived-vars", "wrf-climate-metrics-map"] },
  { id: "sea-level", title: "Sea level", collections: ["sea-level-projections"] },
  { id: "energy", title: "Energy", collections: ["pv-generation", "wind-generation", "hdd-cdd-metrics-mm-boundary-csv"] },
  { id: "stations", title: "Weather stations", collections: ["hadisd", "historical-data-platform"] },
  { id: "profiles", title: "Building and planning profiles", collections: ["typical-met-year", "standard-year", "xmy-persist", "xmy-shock"] },
];

// Datasets whose page has an interactive map. Listed first on the Browse page.
export type DatasetView = { kind: "climate" | "warming" | "places"; placeDataset?: string };

export const DATASET_VIEWS: Record<string, DatasetView> = {
  loca2: { kind: "climate" },
  "wrf-climate-metrics-map": { kind: "warming" },
  "loca2-county": { kind: "places", placeDataset: "counties" },
  hadisd: { kind: "places", placeDataset: "hadisd" },
  "historical-data-platform": { kind: "places", placeDataset: "hdp" },
  "typical-met-year": { kind: "places", placeDataset: "typical-met-year" },
  "standard-year": { kind: "places", placeDataset: "standard-year" },
  "xmy-persist": { kind: "places", placeDataset: "xmy-persist" },
  "xmy-shock": { kind: "places", placeDataset: "xmy-shock" },
};
