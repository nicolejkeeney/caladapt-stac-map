import { STAC_API, TILER } from "./config";

export interface StacItem {
  id: string;
  collection: string;
  geometry: GeoJSON.Geometry | null;
  properties: Record<string, any>;
  assets: Record<string, { href: string; type?: string; title?: string; "file:size"?: number }>;
}

export interface StacCollection {
  id: string;
  title?: string;
  description: string;
  assets?: Record<string, { href: string; roles?: string[] }>;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

type Cql2 = { op: string; args: unknown[] };

export function eq(property: string, value: string): Cql2 {
  return { op: "=", args: [{ property }, value] };
}

/** Search one collection, following `next` links until every match is loaded. */
export async function searchAll(collection: string, filters: Cql2[], signal?: AbortSignal): Promise<StacItem[]> {
  // Geometry is left out: the map already has it, and county polygons make
  // responses large enough to time out.
  const body: Record<string, unknown> = { collections: [collection], limit: 250, fields: { exclude: ["geometry"] } };
  if (filters.length) {
    body["filter-lang"] = "cql2-json";
    body.filter = filters.length === 1 ? filters[0] : { op: "and", args: filters };
  }
  const items: StacItem[] = [];
  let request: { url: string; body: unknown } | null = { url: `${STAC_API}/search`, body };
  while (request) {
    const page: any = await getJson(request.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      signal,
    });
    items.push(...page.features);
    const next = page.links?.find((l: any) => l.rel === "next");
    request = next ? { url: next.href, body: { ...body, ...next.body } } : null;
  }
  return items;
}

export function getItem(collection: string, id: string, signal?: AbortSignal): Promise<StacItem> {
  return getJson(`${STAC_API}/collections/${collection}/items/${encodeURIComponent(id)}`, { signal });
}

export function getCollection(id: string): Promise<StacCollection> {
  return getJson(`${STAC_API}/collections/${id}`);
}

export function getGeoJson(url: string): Promise<GeoJSON.FeatureCollection> {
  return getJson(url);
}

/** s3://bucket/key → public HTTPS URL, so files can be downloaded in a browser. */
export function httpsHref(href: string): string {
  const m = href.match(/^s3:\/\/([^/]+)\/(.*)$/);
  return m ? `https://${m[1]}.s3.amazonaws.com/${m[2]}` : href;
}

// ---------- Tiler ----------

function tilerParams(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/** Tile URL template; `colorTable` is the tiler's intervals colormap JSON from colormap.ts. */
export function tileUrl(opts: { href: string; variable: string; datetime: string; colorTable: string }): string {
  const qs = tilerParams({ url: opts.href, variable: opts.variable, datetime: opts.datetime, colormap: opts.colorTable });
  return `${TILER}/tiles/WebMercatorQuad/{z}/{x}/{y}@1x.png?${qs}`;
}

const infoCache = new Map<string, Promise<any>>();

/** Values of the store's non-spatial dimension (time or warming level) and its name. */
export async function dimension(href: string, variable: string): Promise<{ name: string; values: any[] }> {
  const key = `${href}|${variable}`;
  if (!infoCache.has(key)) {
    const p = getJson(`${TILER}/info?${tilerParams({ url: href, variable })}`);
    p.catch(() => infoCache.delete(key));
    infoCache.set(key, p);
  }
  const info = await infoCache.get(key)!;
  const [name, dim] = Object.entries(info.dimensions ?? {})[0] as [string, any];
  return { name, values: dim.data };
}

export async function pointValue(opts: {
  href: string;
  variable: string;
  datetime: string;
  lng: number;
  lat: number;
  signal?: AbortSignal;
}): Promise<number | null> {
  const qs = tilerParams({ url: opts.href, variable: opts.variable, datetime: opts.datetime });
  const res: any = await getJson(`${TILER}/point/${opts.lng},${opts.lat}?${qs}`, { signal: opts.signal });
  const v = res?.data;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
