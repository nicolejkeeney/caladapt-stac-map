// Everything that maps catalog terms to plain language lives here, so the
// rest of the app never shows raw STAC property names to users.

export const STAC_API = import.meta.env.VITE_STAC_API ?? "https://stac.cal-adapt.org";
export const TILER = import.meta.env.VITE_TILER ?? "https://map.cal-adapt.org";
// STAC Browser uses hash routing, so pages live under /#/ (e.g. /#/collections/loca2)
export const STAC_BROWSER = import.meta.env.VITE_STAC_BROWSER ?? "https://stac-browser.cal-adapt.org/#";

export const CA_BOUNDS: [number, number, number, number] = [-124.6, 32.4, -114.0, 42.1];

// ---------- Gridded climate layers (via the tiler) ----------

export type Frequency = "1hr" | "day" | "mon" | "yrmax";

// How each time step is named in the panel, and what it means
export const STEPS: Record<Frequency, { label: string; note: string }> = {
  "1hr": { label: "Hourly", note: "One simulated hour from a climate model, not a forecast." },
  day: { label: "Daily", note: "One simulated day from a climate model, not a forecast." },
  mon: { label: "Monthly", note: "Summarized over the month." },
  yrmax: { label: "Yearly maximum", note: "The highest value reached that year." },
};

// WRF's nested grids, finest first: each covers a larger area at coarser detail
export const GRIDS: Record<string, string> = {
  d03: "3 km (California)",
  d02: "9 km (western US)",
  d01: "45 km (western North America)",
};

export interface Unit {
  label: string;
  convert: (raw: number) => number;
  digits: number;
}

/** One variable on the map; the time step is picked separately. */
export interface ClimateLayer {
  id: string;
  title: string;
  blurb: string;
  variable: string;
  rescale: [number, number]; // in the file's native units
  rescaleByStep?: Partial<Record<Frequency, [number, number]>>; // where a step needs a different range
  colormap: string; // a name from colormap.ts; drives both tiles and legend
  bins?: number;
  unit: Unit;
  defaultMonth?: number; // 0-based; the month shown when this layer is picked
}

const kelvinToF: Unit = { label: "°F", convert: (k) => ((k - 273.15) * 9) / 5 + 32, digits: 0 };
const percent: Unit = { label: "%", convert: (v) => v * 100, digits: 0 };

const LOCA2_LAYERS: ClimateLayer[] = [
  {
    id: "daily-high",
    title: "Daily high temperature",
    blurb: "The day's highest temperature.",
    variable: "tasmax",
    rescale: [265, 320],
    rescaleByStep: { day: [255, 325], yrmax: [285, 325] },
    colormap: "RdYlBu_r",
    unit: kelvinToF,
  },
  {
    id: "daily-low",
    title: "Daily low temperature",
    blurb: "The day's lowest temperature, usually overnight.",
    variable: "tasmin",
    rescale: [255, 305],
    rescaleByStep: { day: [245, 310] },
    colormap: "RdYlBu_r",
    unit: kelvinToF,
  },
  {
    id: "precip",
    title: "Precipitation",
    blurb: "Rain and snow, as an average amount per day.",
    variable: "pr",
    rescale: [0, 0.0002],
    rescaleByStep: { day: [0, 0.0006] },
    colormap: "Blues",
    defaultMonth: 0, // summers in California are dry, so start in January
    // kg m-2 s-1 is mm/s; show inches per day
    unit: { label: "in/day", convert: (v) => (v * 86400) / 25.4, digits: 2 },
  },
  {
    id: "sunlight",
    title: "Sunlight",
    blurb: "Solar energy reaching the ground.",
    variable: "rsds",
    rescale: [50, 350],
    colormap: "YlOrRd",
    unit: { label: "W/m²", convert: (v) => v, digits: 0 },
  },
  {
    id: "humidity",
    title: "Humidity (daily maximum)",
    blurb: "The most humid point of the day, usually early morning.",
    variable: "hursmax",
    rescale: [20, 100],
    colormap: "GnBu",
    unit: { label: "%", convert: (v) => v, digits: 0 },
  },
  {
    id: "wind",
    title: "Wind speed",
    blurb: "Average near-surface wind speed.",
    variable: "wspeed",
    rescale: [0, 8],
    colormap: "viridis",
    unit: { label: "mph", convert: (v) => v * 2.237, digits: 1 },
  },
];

// WRF's variables. Temperature, sunlight and wind use the same units as LOCA2;
// monthly precipitation is a total in mm, not a rate.
const WRF_LAYERS: ClimateLayer[] = [
  {
    id: "daily-high",
    title: "Daily high temperature",
    blurb: "The day's highest temperature.",
    variable: "t2max",
    rescale: [265, 320],
    colormap: "RdYlBu_r",
    unit: kelvinToF,
  },
  {
    id: "daily-low",
    title: "Daily low temperature",
    blurb: "The day's lowest temperature, usually overnight.",
    variable: "t2min",
    rescale: [255, 305],
    colormap: "RdYlBu_r",
    unit: kelvinToF,
  },
  {
    id: "precip",
    title: "Precipitation",
    blurb: "Total rain and snow.",
    variable: "prec",
    rescale: [0, 200],
    colormap: "Blues",
    defaultMonth: 0, // summers in California are dry, so start in January
    unit: { label: "in/month", convert: (mm) => mm / 25.4, digits: 1 },
  },
  {
    id: "sunlight",
    title: "Sunlight",
    blurb: "Solar energy reaching the ground.",
    variable: "sw_dwn",
    rescale: [50, 350],
    colormap: "YlOrRd",
    unit: { label: "W/m²", convert: (v) => v, digits: 0 },
  },
  {
    id: "humidity",
    title: "Humidity",
    blurb: "Average relative humidity.",
    variable: "rh",
    rescale: [10, 100],
    colormap: "GnBu",
    unit: { label: "%", convert: (v) => v, digits: 0 },
  },
  {
    id: "wind",
    title: "Wind speed",
    blurb: "Average near-surface wind speed.",
    variable: "wspd10mean",
    rescale: [0, 8],
    colormap: "viridis",
    unit: { label: "mph", convert: (v) => v * 2.237, digits: 1 },
  },
];

// Gridded climate-model collections that share the map view: one entry per
// STAC collection, with the item filters that pick its California grid.
export interface GriddedDataset {
  filters: Record<string, string | boolean>;
  layers: ClimateLayer[];
  // Time steps the tiler can draw, in the order offered. WRF's daily and hourly
  // stores are chunked for time series (about 14,500 steps per chunk), so a map
  // tile would read gigabytes and time out; those steps are left out.
  steps: Frequency[];
  dayTime?: string; // time of day the daily values are stamped with, when not midnight
  // Smaller tiles for stores whose chunks are deep in time: more requests run in
  // parallel, each reading fewer chunks (128 drew the wind map in ~7 s vs ~14 s at 256)
  tileSize?: number;
  about: string;
  aboutTerm?: { slug: keyof typeof import("./data/glossary.json"); label: string }; // a phrase in `about` linked to the glossary
}

export const GRIDDED_DATASETS: Record<string, GriddedDataset> = {
  loca2: {
    filters: {},
    layers: LOCA2_LAYERS,
    steps: ["day", "mon", "yrmax"],
    dayTime: "T12:00:00",
    about: "LOCA2: 15 climate models statistically downscaled to a 3 km grid by UC San Diego.",
    aboutTerm: { slug: "statistical-downscaling", label: "statistically downscaled" },
  },
  "wrf-ucla": {
    // Bias-adjusted runs; the grid is picked in the panel
    filters: { bias_adjusted: true },
    layers: WRF_LAYERS,
    steps: ["mon"],
    about: "WRF: climate models dynamically downscaled by UCLA, at 3 km over California and coarser over the western US.",
    aboutTerm: { slug: "dynamical-downscaling", label: "dynamically downscaled" },
  },
  "pv-generation": {
    // Utility-scale solar on the 3 km grid
    filters: { "cmip6:grid_label": "d03", installation: "pv_utility" },
    layers: [
      {
        id: "capacity-factor",
        title: "Solar capacity factor",
        blurb: "The share of a solar farm's full capacity it produces.",
        variable: "cf",
        rescale: [0, 0.5],
        colormap: "YlOrRd",
        unit: percent,
      },
    ],
    steps: ["day"],
    tileSize: 128,
    about: "Utility-scale solar output simulated from WRF climate projections. Map tiles load slowly.",
  },
  "wind-generation": {
    // Onshore wind on the 3 km grid
    filters: { "cmip6:grid_label": "d03", installation: "windpower_onshore" },
    layers: [
      {
        id: "capacity-factor",
        title: "Wind capacity factor",
        blurb: "The share of a wind turbine's full capacity it produces.",
        variable: "cf",
        rescale: [0, 0.7],
        colormap: "viridis",
        unit: percent,
      },
    ],
    steps: ["day"],
    tileSize: 128,
    about: "Onshore wind output simulated from WRF climate projections. Map tiles load slowly.",
  },
};

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
  {
    // 13 NOAA tide stations; one NetCDF file per sea level rise and emissions scenario
    id: "sea-level",
    collection: "sea-level-projections",
    kind: "station",
    idProperty: "station_code",
    nameProperty: "station_name",
    match: { type: "property", property: "station_id" },
    filters: [
      { property: "slr_scenario", label: "Sea level rise scenario" },
      { property: "cmip6:experiment_id", label: "Emissions scenario" },
    ],
  },
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

// ---------- Boundary summaries (WRF tool CSVs colored by region) ----------

export const COUNTY_GEOMETRIES_URL = "https://cadcat.s3.amazonaws.com/geometries/ca-counties-geometries.geojson";

export interface BoundaryMetric {
  id: string; // the items' variable_id
  title: string;
  blurb: string;
  unit: Unit;
  colormap: string;
  defaultThreshold: string; // matches the website's extreme heat tool
}

// One CSV per region and threshold, with multi-model median, p10 and p90 at each
// warming level. Counties only for now: other boundaries have no GeoJSON yet.
export const BOUNDARY_TOOLS: Record<string, { metrics: BoundaryMetric[]; boundary: string }> = {
  "eh-metrics-mm-boundary-csv": {
    boundary: "ca_counties",
    metrics: [
      {
        id: "eh_days",
        title: "Extreme heat days",
        blurb: "Days per year when the high temperature reaches the threshold or hotter.",
        unit: { label: "days", convert: (v) => v, digits: 0 },
        colormap: "cal-adapt-extreme-heat",
        defaultThreshold: "t2max_ge95F",
      },
      {
        id: "warm_nights",
        title: "Warm nights",
        blurb: "Nights per year when the low temperature stays at the threshold or warmer.",
        unit: { label: "nights", convert: (v) => v, digits: 0 },
        colormap: "cal-adapt-warm-nights",
        defaultThreshold: "t2min_ge70F",
      },
    ],
  },
};

// Datasets whose page has an interactive map. Listed first on the Browse page.
export type DatasetView = { kind: "climate" | "warming" | "places" | "boundary"; placeDataset?: string };

export const DATASET_VIEWS: Record<string, DatasetView> = {
  loca2: { kind: "climate" },
  "wrf-ucla": { kind: "climate" },
  "pv-generation": { kind: "climate" },
  "wind-generation": { kind: "climate" },
  "wrf-climate-metrics-map": { kind: "warming" },
  "loca2-county": { kind: "places", placeDataset: "counties" },
  hadisd: { kind: "places", placeDataset: "hadisd" },
  "historical-data-platform": { kind: "places", placeDataset: "hdp" },
  "typical-met-year": { kind: "places", placeDataset: "typical-met-year" },
  "standard-year": { kind: "places", placeDataset: "standard-year" },
  "xmy-persist": { kind: "places", placeDataset: "xmy-persist" },
  "xmy-shock": { kind: "places", placeDataset: "xmy-shock" },
  "sea-level-projections": { kind: "places", placeDataset: "sea-level" },
  "eh-metrics-mm-boundary-csv": { kind: "boundary" },
};
