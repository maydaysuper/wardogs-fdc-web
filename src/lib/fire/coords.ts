/** WARDOGS map: 1 coordinate unit = 100 m. Y increases north. 0–163.84. */

export const METERS_PER_UNIT = 100;
export const MAP_SIZE_UNITS = 163.84;
export const KM_CELL = 10;

export type Vec = { x: number; y: number };

export function distanceMeters(a: Vec, b: Vec): number {
  return Math.hypot((b.x - a.x) * METERS_PER_UNIT, (b.y - a.y) * METERS_PER_UNIT);
}

/** Compass degrees: 0 = north, 90 = east, clockwise. */
export function azimuthDeg(from: Vec, to: Vec): number {
  const east = to.x - from.x;
  const north = to.y - from.y;
  if (east === 0 && north === 0) return 0;
  let deg = Math.atan2(east, north) * (180 / Math.PI);
  if (deg < 0) deg += 360;
  return deg;
}

export function degToDirMils(deg: number): number {
  return (deg / 360) * 6400;
}

export function formatAzimuth(deg: number): string {
  return `${deg.toFixed(1).padStart(5, "0")}°`;
}

export function gridRef(p: Vec): string {
  const col = Math.floor(p.x / KM_CELL);
  const row = Math.floor(p.y / KM_CELL);
  if (col < 0 || col > 15 || row < 0 || row > 15) {
    return `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`;
  }
  const letter = String.fromCharCode(65 + col);
  const e = Math.min(9, Math.floor(((p.x / KM_CELL) - col) * 10));
  const n = Math.min(9, Math.floor(((p.y / KM_CELL) - row) * 10));
  return `${letter}${row + 1}-${e}${n}`;
}

export function formatXy(p: Vec): string {
  return `${p.x.toFixed(2)}  ${p.y.toFixed(2)}`;
}

export function parseGrid(text: string): Vec | null {
  const m = text
    .trim()
    .match(/^([A-P])\s*0?([1-9]|1[0-6])(?:\s*[-–.]\s*([0-9])([0-9]))?$/i);
  if (!m) return null;
  const col = m[1].toUpperCase().charCodeAt(0) - 65;
  const row = Number(m[2]) - 1;
  if (m[3] != null && m[4] != null) {
    const e = Number(m[3]);
    const n = Number(m[4]);
    return { x: col * KM_CELL + e + 0.5, y: row * KM_CELL + n + 0.5 };
  }
  return { x: col * KM_CELL + 5, y: row * KM_CELL + 5 };
}

export function parsePair(text: string): Vec | null {
  const t = text.trim().replace(/,/g, " ").replace(/[|/]/g, " ");
  if (!t) return null;

  const grid = parseGrid(t);
  if (grid) return grid;

  const named = t.match(
    /x\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*y\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i,
  );
  if (named) {
    const x = Number(named[1]);
    const y = Number(named[2]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }

  const nums = t.match(/-?\d+(?:\.\d+)?/g);
  if (nums && nums.length >= 2) {
    const x = Number(nums[0]);
    const y = Number(nums[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return null;
}

export function clampMap(p: Vec): Vec {
  return {
    x: Math.min(MAP_SIZE_UNITS, Math.max(0, p.x)),
    y: Math.min(MAP_SIZE_UNITS, Math.max(0, p.y)),
  };
}

export function siteAngleMils(rangeM: number, dH: number): number {
  if (rangeM < 1) return 0;
  return (dH / rangeM) * 1000;
}
