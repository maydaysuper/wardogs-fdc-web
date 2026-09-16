import { MAP_SIZE_UNITS } from "./coords.ts";
import { type GameMap } from "./maps.ts";

export const TILE_PX = 256;
export const LOCAL_MAX_ZOOM = 3;
const CACHE_LIMIT = 96;

type Status = "loading" | "ok" | "fail";
export interface TileRec {
  img: HTMLImageElement;
  status: Status;
}

const CACHE = new Map<string, TileRec>();
const BASE = new Map<string, TileRec>();
const ORDER: string[] = [];
const listeners = new Set<() => void>();

export function onTilesChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function ping() {
  listeners.forEach((fn) => fn());
}

export function tileKey(mapId: string, z: number, tx: number, ty: number): string {
  return `${mapId}:${z}:${tx}:${ty}`;
}

export function tileUrl(map: GameMap, z: number, tx: number, ty: number): string {
  if (z <= LOCAL_MAX_ZOOM) return `/maps/${map.id}/zoom_${z}/${tx}_${ty}.webp`;
  return `${map.tiles}/zoom_${z}/${tx}_${ty}.webp`;
}

function touch(key: string) {
  const i = ORDER.indexOf(key);
  if (i >= 0) ORDER.splice(i, 1);
  ORDER.push(key);
}

function dropTile(key: string) {
  const rec = CACHE.get(key);
  if (!rec) return;
  rec.img.onload = null;
  rec.img.onerror = null;
  rec.img.src = "";
  CACHE.delete(key);
}

function evict() {
  while (CACHE.size > CACHE_LIMIT && ORDER.length) {
    const old = ORDER.shift();
    if (old) dropTile(old);
  }
}

function loadImage(src: string, rec: TileRec) {
  rec.img.decoding = "async";
  rec.img.onload = () => {
    rec.status = "ok";
    ping();
  };
  rec.img.onerror = () => {
    rec.status = "fail";
    ping();
  };
  rec.img.src = src;
}

export function getBaseMap(map: GameMap): TileRec {
  const hit = BASE.get(map.id);
  if (hit) return hit;
  const rec: TileRec = { img: new Image(), status: "loading" };
  loadImage(`/maps/${map.id}.webp`, rec);
  BASE.set(map.id, rec);
  return rec;
}

export function getTile(map: GameMap, z: number, tx: number, ty: number): TileRec {
  const key = tileKey(map.id, z, tx, ty);
  const hit = CACHE.get(key);
  if (hit) {
    touch(key);
    return hit;
  }
  const rec: TileRec = { img: new Image(), status: "loading" };
  loadImage(tileUrl(map, z, tx, ty), rec);
  CACHE.set(key, rec);
  touch(key);
  evict();
  return rec;
}

export function ancestorSource(
  map: GameMap,
  z: number,
  tx: number,
  ty: number,
): { rec: TileRec; sx: number; sy: number; ss: number } | null {
  for (let dz = 1; dz <= z; dz++) {
    const pz = z - dz;
    const px = tx >> dz;
    const py = ty >> dz;
    const rec = CACHE.get(tileKey(map.id, pz, px, py));
    if (rec?.status === "ok") {
      const factor = 2 ** dz;
      const ss = TILE_PX / factor;
      return {
        rec,
        sx: (tx - px * factor) * ss,
        sy: (ty - py * factor) * ss,
        ss,
      };
    }
  }
  return null;
}

export function prefetchBase(map: GameMap) {
  getBaseMap(map);
  getTile(map, 0, 0, 0);
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) getTile(map, 1, tx, ty);
  }
}

export function canvasDpr(cssW: number): number {
  const raw = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  if (cssW < 430) return Math.min(1.15, raw);
  if (cssW < 640) return Math.min(1.25, raw);
  return Math.min(2, raw);
}

export function pickTileZoom(viewS: number, cssPx: number, maxZoom: number): number {
  const worldW = MAP_SIZE_UNITS;
  const base = TILE_PX / worldW;
  const desired = cssPx / viewS;
  const raw = Math.log2(desired / base);
  const cap = cssPx < 640 ? Math.min(maxZoom, LOCAL_MAX_ZOOM) : maxZoom;
  return Math.min(cap, Math.max(0, Math.round(raw)));
}
