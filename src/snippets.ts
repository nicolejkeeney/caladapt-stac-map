// Code people can copy to get the data currently on the map. Every snippet
// reads anonymously from the public cadcat bucket.

import { MODEL_NAMES, STAC_API, WarmingLayer, WarmingVariant } from "./config";
import type { StacItem } from "./stac";

export interface AccessMethod {
  id: string;
  label: string;
  intro: string;
  code: string;
  language: "Python" | "shell";
}

const s3Folder = (href: string) => {
  const m = href.match(/^s3:\/\/([^/]+)\/(.*?)\/?$/);
  return m ? `https://${m[1]}.s3.amazonaws.com/index.html#${m[2]}/` : href;
};

const shell = (href: string, name: string): AccessMethod => ({
  id: "s3",
  label: "AWS CLI",
  intro: "Copy the Zarr store to your computer. No AWS account is needed.",
  code: `aws s3 sync ${href.replace(/\/?$/, "/")} ./${name}.zarr --no-sign-request`,
  language: "shell",
});

export function loca2Methods(item: StacItem, variable: string, timeSel: string): { methods: AccessMethod[]; browse: string } {
  const href = item.assets.data.href;
  const p = item.properties;
  const model = MODEL_NAMES[p["cmip6:source_id"]] ?? p["cmip6:source_id"];
  const filters = [
    ["variable_id", variable],
    ["cmip6:table_id", p["cmip6:table_id"]],
    ["cmip6:experiment_id", p["cmip6:experiment_id"]],
  ]
    .map(([k, v]) => `        {"op": "=", "args": [{"property": "${k}"}, "${v}"]},`)
    .join("\n");

  return {
    browse: s3Folder(href),
    methods: [
      {
        id: "xarray",
        label: "Python",
        intro: "Open the data straight from cloud storage with xarray. Nothing is downloaded until you use it.",
        language: "Python",
        code: `import xarray as xr

ds = xr.open_zarr(
    "${href}",
    storage_options={"anon": True},
)
da = ds["${variable}"].sel(time="${timeSel}")  # the time shown on the map`,
      },
      {
        id: "climakitae",
        label: "climakitae",
        intro: "Cal-Adapt's Python library adds unit conversion, area subsetting and warming-level tools.",
        language: "Python",
        code: `# pip install climakitae  (version 1.5.10 or later)
from climakitae.new_core.user_interface import ClimateData

data = (
    ClimateData()
    .catalog("cadcat")
    .activity_id("LOCA2")
    .source_id("${model}")
    .experiment_id("${p["cmip6:experiment_id"]}")
    .table_id("${p["cmip6:table_id"]}")
    .grid_label("${p["cmip6:grid_label"]}")
    .variable_id("${variable}")
    .get()
)
# Every ensemble member comes back along a "sim" dimension
da = data["${variable}"].sel(
    sim="loca2_ucsd_${p["cmip6:source_id"]}_${p["cmip6:experiment_id"]}_${p["cmip6:member_id"]}",  # the run on the map
    time="${timeSel}",
)`,
      },
      {
        id: "stac",
        label: "STAC",
        intro: "Search the catalog to get this run, or every model at once.",
        language: "Python",
        code: `import xarray as xr
from pystac_client import Client

catalog = Client.open("${STAC_API}")

# This model run
item = catalog.get_collection("${item.collection}").get_item("${item.id}")
ds = xr.open_zarr(item.assets["data"].href, storage_options={"anon": True})

# Every model for the same variable and scenario
items = catalog.search(
    collections=["${item.collection}"],
    filter={"op": "and", "args": [
${filters}
    ]},
).item_collection()`,
      },
      shell(href, `${p["cmip6:source_id"]}_${p["cmip6:experiment_id"]}_${p["cmip6:table_id"]}_${variable}`),
    ],
  };
}

export function warmingMethods(layer: WarmingLayer, view: WarmingVariant, dimName: string, level: number) {
  const methods: AccessMethod[] = [
    {
      id: "xarray",
      label: "Python",
      intro: "Open the multi-model average, minimum and maximum with xarray.",
      language: "Python",
      code: `import xarray as xr

stores = {
    "mean": "${view.mean}",
    "min": "${view.min}",
    "max": "${view.max}",
}
ds = {
    stat: xr.open_zarr(path, storage_options={"anon": True})["${view.variable}"]
    for stat, path in stores.items()
}
mean = ds["mean"].sel(${dimName}=${level.toFixed(1)})  # the level shown on the map`,
    },
  ];
  if (layer.stacCollection) {
    const stat = view.mean.split("/").slice(-5, -4)[0];
    methods.push({
      id: "stac",
      label: "STAC",
      intro: "Find every statistic and metric for this collection in the catalog.",
      language: "Python",
      code: `from pystac_client import Client

catalog = Client.open("${STAC_API}")
items = catalog.search(
    collections=["${layer.stacCollection}"],
    filter={"op": "=", "args": [{"property": "variable_id"}, "${view.variable}"]},
).item_collection()
# One item per statistic, e.g. ${stat}`,
    });
  }
  methods.push(shell(view.mean, `${view.variable}_mean`));
  return { methods, browse: s3Folder(view.mean) };
}
