import { assetUrl } from "@/lib/asset";
import { MAP_SIZE_UNITS } from "./coords.ts";
import { type GameMap } from "./maps.ts";

export const TILE_PX = 256;
export const LOCAL_MAX_ZOOM = 3;
const CACHE_LIMIT = 180;
const MAX_INFLIGHT = 6;

type Status = "loading" | "ok" | "fail";
export interface TileRec {
  img: HTMLImageElement;
  status: Status;
}

const CACHE = new Map<string, TileRec>();
const BASE = new Map<string, TileRec>();
const ORDER: string[] = [];
const listeners = new Set<() => void>();
const queue: Array<() => void> = [];
let inflight = 0;
let loadGen = 0;

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
  if (z <= LOCAL_MAX_ZOOM) return assetUrl(`maps/${map.id}/zoom_${z}/${tx}_${ty}.webp`);
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

function pump() {
  while (inflight < MAX_INFLIGHT && queue.length) {
    const next = queue.shift();
    if (next) next();
  }
}

function loadImage(src: string, rec: TileRec, gen: number) {
  const start = () => {
    if (gen !== loadGen) {
      rec.status = "fail";
      return;
    }
    inflight += 1;
    rec.img.decoding = "async";
    rec.img.onload = () => {
      inflight = Math.max(0, inflight - 1);
      if (gen !== loadGen) {
        rec.status = "fail";
        pump();
        return;
      }
      rec.status = "ok";
      if (typeof rec.img.decode === "function") {
        rec.img.decode().catch(() => undefined).finally(ping);
      } else {
        ping();
      }
      pump();
    };
    rec.img.onerror = () => {
      inflight = Math.max(0, inflight - 1);
      rec.status = "fail";
      ping();
      pump();
    };
    rec.img.src = src;
  };
  if (inflight >= MAX_INFLIGHT) queue.push(start);
  else start();
}

export function resetTileLoads() {
  loadGen += 1;
  queue.length = 0;
  inflight = 0;
}

export function getBaseMap(map: GameMap): TileRec {
  const hit = BASE.get(map.id);
  if (hit) return hit;
  const rec: TileRec = { img: new Image(), status: "loading" };
  loadImage(assetUrl(`maps/${map.id}.webp`), rec, loadGen);
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
  loadImage(tileUrl(map, z, tx, ty), rec, loadGen);
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
