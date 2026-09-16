import type { Vec } from "./coords.ts";

export type MapId = "bakurani" | "ozeti" | "zestafona";

export type MarkerKind = "tower" | "valkyra" | "manticore" | "lonestar";

export interface MapMarker {
  kind: MarkerKind;
  label: string;
  /** Exact game-coordinate anchor. 1 coordinate unit = 100 m. */
  pos: Vec;
}

export interface SpawnPoly {
  id: string;
  label: string;
  tone: "valkyra" | "manticore" | "lonestar";
  points: Vec[];
}

export interface GameMap {
  id: MapId;
  name: string;
  nameZh: string;
  tiles: string;
  minZoom: number;
  maxZoom: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  tileBounds: { minX: number; maxX: number; minY: number; maxY: number };
  markers: MapMarker[];
  spawns: SpawnPoly[];
}

export type Cam = { x: number; y: number; s: number };
export type Viewport = { w: number; h: number };

const m = (meters: number) => meters / 100;

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

export const MAPS: Record<MapId, GameMap> = {
  bakurani: {
    id: "bakurani",
    name: "Bakurani",
    nameZh: "巴库拉尼",
    tiles: "https://assets.wardogs-artillery.com/releases/assets-v1/maps/tiles/bakurani",
    minZoom: 0,
    maxZoom: 7,
    bounds: { minX: 23.35, maxX: 133.6, minY: 19.34, maxY: 129.65 },
    tileBounds: { minX: -0.03, maxX: 163.81, minY: -0.01, maxY: 163.83 },
    markers: [
      { kind: "tower", label: "塔 1", pos: { x: 80.52, y: 69.85 } },
      { kind: "tower", label: "塔 2", pos: { x: 77.19, y: 70.0 } },
      { kind: "tower", label: "塔 3", pos: { x: 77.19, y: 73.44 } },
      { kind: "tower", label: "塔 4", pos: { x: 83.64, y: 72.85 } },
      { kind: "tower", label: "塔 5", pos: { x: 82.22, y: 68.41 } },
      { kind: "valkyra", label: "VALKYRA", pos: { x: m(11875), y: m(7093) } },
      { kind: "manticore", label: "MANTICORE", pos: { x: m(4009), y: m(7752) } },
      { kind: "lonestar", label: "LONESTAR", pos: { x: m(8746), y: m(3250) } },
    ],
    spawns: [
      {
        id: "v",
        label: "VALKYRA",
        tone: "valkyra",
        points: [
          { x: m(11750), y: m(7376) },
          { x: m(12122), y: m(7071) },
          { x: m(11818), y: m(6699) },
          { x: m(11445), y: m(7004) },
        ],
      },
      {
        id: "m",
        label: "MANTICORE",
        tone: "manticore",
        points: [
          { x: m(3868), y: m(7988) },
          { x: m(4339), y: m(7885) },
          { x: m(4235), y: m(7415) },
          { x: m(3765), y: m(7518) },
        ],
      },
      {
        id: "l",
        label: "LONESTAR",
        tone: "lonestar",
        points: [
          { x: m(8308), y: m(3527) },
          { x: m(8772), y: m(3651) },
          { x: m(8897), y: m(3186) },
          { x: m(8432), y: m(3062) },
        ],
      },
    ],
  },
  ozeti: {
    id: "ozeti",
    name: "Ozeti",
    nameZh: "奥泽蒂",
    tiles: "https://assets.wardogs-artillery.com/releases/assets-v1/maps/tiles/ozeti",
    minZoom: 0,
    maxZoom: 7,
    bounds: { minX: 57.58, maxX: 143.07, minY: 21.81, maxY: 99.56 },
    tileBounds: { minX: -0.03, maxX: 163.81, minY: -0.01, maxY: 163.83 },
    markers: [
      { kind: "tower", label: "塔 1", pos: { x: 95.8, y: 62.82 } },
      { kind: "tower", label: "塔 2", pos: { x: 100.37, y: 59.23 } },
      { kind: "tower", label: "塔 3", pos: { x: 104.49, y: 63.71 } },
      { kind: "tower", label: "塔 4", pos: { x: 100.62, y: 67.64 } },
      { kind: "valkyra", label: "VALKYRA", pos: { x: m(13803), y: m(6733) } },
      { kind: "manticore", label: "MANTICORE", pos: { x: m(6828), y: m(8803) } },
      { kind: "lonestar", label: "LONESTAR", pos: { x: m(8373), y: m(3069) } },
    ],
    spawns: [
      {
        id: "v",
        label: "VALKYRA",
        tone: "valkyra",
        points: [
          { x: m(13398), y: m(6851) },
          { x: m(13858), y: m(6992) },
          { x: m(13999), y: m(6532) },
          { x: m(13539), y: m(6391) },
        ],
      },
      {
        id: "m",
        label: "MANTICORE",
        tone: "manticore",
        points: [
          { x: m(6922), y: m(9085) },
          { x: m(7309), y: m(8798) },
          { x: m(7022), y: m(8412) },
          { x: m(6636), y: m(8699) },
        ],
      },
      {
        id: "l",
        label: "LONESTAR",
        tone: "lonestar",
        points: [
          { x: m(8152), y: m(3403) },
          { x: m(8633), y: m(3403) },
          { x: m(8633), y: m(2921) },
          { x: m(8153), y: m(2922) },
        ],
      },
    ],
  },
  zestafona: {
    id: "zestafona",
    name: "Zestafona",
    nameZh: "泽斯塔福纳",
    tiles: "https://assets.wardogs-artillery.com/releases/assets-v1/maps/tiles/zestafona",
    minZoom: 0,
    maxZoom: 7,
    bounds: { minX: 19.9, maxX: 124.89, minY: 50.7, maxY: 141.9 },
    tileBounds: { minX: -0.03, maxX: 163.81, minY: -0.01, maxY: 163.83 },
    markers: [
      { kind: "tower", label: "塔 1", pos: { x: 68.6, y: 104.15 } },
      { kind: "tower", label: "塔 2", pos: { x: 72.89, y: 105.07 } },
      { kind: "tower", label: "塔 3", pos: { x: 70.17, y: 100.17 } },
      { kind: "valkyra", label: "VALKYRA", pos: { x: m(3943.6288), y: m(12494.4384) } },
      { kind: "manticore", label: "MANTICORE", pos: { x: m(10466.0992), y: m(11508.1216) } },
      { kind: "lonestar", label: "LONESTAR", pos: { x: m(6800.9984), y: m(6660.096) } },
    ],
    spawns: [
      {
        id: "m",
        label: "MANTICORE",
        tone: "manticore",
        points: [
          { x: m(10330.11), y: m(11170.61) },
          { x: m(10190.84), y: m(11631.0) },
          { x: m(10651.23), y: m(11768.62) },
          { x: m(10788.86), y: m(11309.87) },
        ],
      },
      {
        id: "v",
        label: "VALKYRA",
        tone: "valkyra",
        points: [
          { x: m(4027.18), y: m(12188.05) },
          { x: m(3570.07), y: m(12335.51) },
          { x: m(3717.5296), y: m(12792.62) },
          { x: m(4174.64), y: m(12645.17) },
        ],
      },
      {
        id: "l",
        label: "LONESTAR",
        tone: "lonestar",
        points: [
          { x: m(6512.64), y: m(6481.51) },
          { x: m(6630.6), y: m(6946.81) },
          { x: m(7095.91), y: m(6827.21) },
          { x: m(6977.94), y: m(6361.9) },
        ],
      },
    ],
  },
};

/**
 * Tower pins sit on the compound, not the access road.
 * Source: wardogs-calculator maps/*.json (metres / 100), checked on z6 tiles 2026-09-15.
 * Bakurani/Ozeti/Zestafona: T1–T5 / T1–T4 / T1–T3. Inactive map-file names (向日葵, 塔 7, abandoned) are not capturable pins.
 */
export const TOWER_CALIBRATION_VERIFIED_AT = "2026-09-15";
/** Compound radius drawn around each pin. */
export const TOWER_RADIUS_M = 45;

export function getTowerMarkers(map: GameMap): MapMarker[] {
  return map.markers.filter((marker) => marker.kind === "tower");
}

export function getFobMarkers(map: GameMap): MapMarker[] {
  const order = ["valkyra", "lonestar", "manticore"];
  return map.markers
    .filter((marker) => marker.kind !== "tower")
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

export const MAP_LIST = Object.values(MAPS);

export const DEFAULT_VIEWPORT: Viewport = { w: 1280, h: 800 };

/** Visible world-height of a camera at the given viewport. */
export function visHeight(s: number, vp: Viewport): number {
  const w = Math.max(1, vp.w);
  return (s * Math.max(1, vp.h)) / w;
}

/** Keep the camera inside the 16 km square and covering the viewport (no letterbox). */
export function clampCam(cam: Cam, mapSize: number, vp: Viewport): Cam {
  const w = Math.max(1, vp.w);
  const h = Math.max(1, vp.h);
  const minS = Math.min(mapSize, (MIN_SPAN * w) / Math.min(w, h));
  const maxS = (mapSize * w) / Math.max(w, h);
  let s = cam.s;
  if (!Number.isFinite(s) || s <= 0) s = maxS;
  s = clamp(s, minS, maxS);
  const visH = visHeight(s, vp);
  const x = clamp(cam.x, 0, Math.max(0, mapSize - s));
  const y = clamp(cam.y, 0, Math.max(0, mapSize - visH));
  return { s, x, y };
}

const MIN_SPAN = 2.4;

/**
 * Fit `bounds` into the viewport the way the in-game map does:
 * terrain always covers the screen (cover), never letterboxed.
 */
export function fitView(
  bounds: GameMap["bounds"],
  mapSize: number,
  vp: Viewport = DEFAULT_VIEWPORT,
  pad = 6,
): Cam {
  const w = Math.max(8, vp.w);
  const h = Math.max(8, vp.h);
  const bw = Math.max(8, bounds.maxX - bounds.minX + pad * 2);
  const bh = Math.max(8, bounds.maxY - bounds.minY + pad * 2);
  const fitScale = Math.min(w / bw, h / bh);
  const coverScale = Math.max(w, h) / mapSize;
  const scale = Math.max(fitScale, coverScale);
  const s = w / scale;
  const visH = h / scale;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cySvg = mapSize - (bounds.minY + bounds.maxY) / 2;
  return clampCam(
    { s, x: cx - s / 2, y: cySvg - visH / 2 },
    mapSize,
    { w, h },
  );
}

/** Frame every capturable tower with padding so a tight cluster does not merge. */
export function fitTowersView(
  map: GameMap,
  mapSize: number,
  vp: Viewport = DEFAULT_VIEWPORT,
): Cam {
  const towers = getTowerMarkers(map);
  if (!towers.length) return fitView(map.bounds, mapSize, vp);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const tower of towers) {
    minX = Math.min(minX, tower.pos.x);
    maxX = Math.max(maxX, tower.pos.x);
    minY = Math.min(minY, tower.pos.y);
    maxY = Math.max(maxY, tower.pos.y);
  }
  return fitView({ minX, maxX, minY, maxY }, mapSize, vp, 3);
}

/** Frame a haul origin → dest so both pins sit in view with road-like padding. */
export function fitHaulView(
  origin: Vec,
  dest: Vec,
  mapSize: number,
  vp: Viewport = DEFAULT_VIEWPORT,
): Cam {
  const minX = Math.min(origin.x, dest.x);
  const maxX = Math.max(origin.x, dest.x);
  const minY = Math.min(origin.y, dest.y);
  const maxY = Math.max(origin.y, dest.y);
  const span = Math.hypot(maxX - minX, maxY - minY);
  const pad = Math.max(8, span * 0.28);
  return fitView({ minX, maxX, minY, maxY }, mapSize, vp, pad);
}

export function centerView(p: Vec, s: number, mapSize: number, vp: Viewport = DEFAULT_VIEWPORT): Cam {
  const svgY = mapSize - p.y;
  const visH = visHeight(s, vp);
  return clampCam({ s, x: p.x - s / 2, y: svgY - visH / 2 }, mapSize, vp);
}

/** Zoom so `span` world-units fill the shorter viewport side, then center. */
export function focusView(p: Vec, span: number, mapSize: number, vp: Viewport): Cam {
  const w = Math.max(8, vp.w);
  const h = Math.max(8, vp.h);
  const scale = Math.min(w, h) / Math.max(2, span);
  return centerView(p, w / scale, mapSize, { w, h });
}
