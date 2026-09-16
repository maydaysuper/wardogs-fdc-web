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

interface Job {
  key: string;
  src: string;
  rec: TileRec;
  gen: number;
  pri: number;
}

const CACHE = new Map<string, TileRec>();
const BASE = new Map<string, TileRec>();
const ORDER: string[] = [];
const listeners = new Set<() => void>();
const jobs = new Map<string, Job>();
let inflight = 0;
let loadGen = 0;
let lastZoom = 2;
let lastMapId = "";

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
    let victim: string | undefined;
    for (const key of ORDER) {
      if (!key.startsWith(`${lastMapId}:${lastZoom}:`)) {
        victim = key;
        break;
      }
    }
    victim ??= ORDER[0];
    if (!victim) break;
    const i = ORDER.indexOf(victim);
    if (i >= 0) ORDER.splice(i, 1);
    dropTile(victim);
  }
}

function nextJob(): Job | undefined {
  let best: Job | undefined;
  for (const job of jobs.values()) {
    if (!best || job.pri > best.pri) best = job;
  }
  if (best) jobs.delete(best.key);
  return best;
}

function pump() {
  while (inflight < MAX_INFLIGHT) {
    const job = nextJob();
    if (!job) return;
    if (job.gen !== loadGen) continue;
    startJob(job);
  }
}

function startJob(job: Job) {
  inflight += 1;
  const { rec, src, gen } = job;
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
}

function enqueue(map: GameMap, z: number, tx: number, ty: number, pri: number): TileRec {
  const key = tileKey(map.id, z, tx, ty);
  const hit = CACHE.get(key);
  if (hit) {
    touch(key);
    const pending = jobs.get(key);
    if (pending && pri > pending.pri) pending.pri = pri;
    return hit;
  }
  const rec: TileRec = { img: new Image(), status: "loading" };
  CACHE.set(key, rec);
  touch(key);
  evict();
  const existing = jobs.get(key);
  if (existing) {
    if (pri > existing.pri) existing.pri = pri;
    return rec;
  }
  jobs.set(key, { key, src: tileUrl(map, z, tx, ty), rec, gen: loadGen, pri });
  pump();
  return rec;
}

export function resetTileLoads() {
  loadGen += 1;
  jobs.clear();
  inflight = 0;
}

export function getBaseMap(map: GameMap): TileRec {
  const hit = BASE.get(map.id);
  if (hit) return hit;
  const rec: TileRec = { img: new Image(), status: "loading" };
  BASE.set(map.id, rec);
  const src = assetUrl(`maps/${map.id}.webp`);
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
  return rec;
}

export function getTile(map: GameMap, z: number, tx: number, ty: number): TileRec {
  lastMapId = map.id;
  lastZoom = z;
  if (z > 0) enqueue(map, z - 1, tx >> 1, ty >> 1, 60);
  return enqueue(map, z, tx, ty, 100);
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
  const base = BASE.get(map.id);
  if (base?.status === "ok") {
    const n = 2 ** z;
    return {
      rec: base,
      sx: (tx / n) * base.img.width,
      sy: (ty / n) * base.img.height,
      ss: base.img.width / n,
    };
  }
  return null;
}

export function prefetchBase(map: GameMap) {
  lastMapId = map.id;
  getBaseMap(map);
  enqueue(map, 0, 0, 0, 40);
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
  let z = Math.min(cap, Math.max(0, Math.round(raw)));
  if (Math.abs(raw - lastZoom) < 0.35 && lastZoom <= cap) z = lastZoom;
  lastZoom = z;
  return z;
}
