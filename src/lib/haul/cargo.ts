import raw from "../../config/haul/cargo.json" with { type: "json" };
import { PALLET_BUY } from "./economy.ts";
import { getBed, type BedSpec } from "./catalog.ts";

export type CargoTab = "pallets" | "crates" | "items";
export type CargoKind = "pallet" | "crate" | "item";
export type CargoSlot = "bed" | "kit";
export type SupplyKind = "build" | "ammo" | "fuel" | "mech";

export interface CargoItem {
  id: string;
  tab: CargoTab;
  nameZh: string;
  nameEn: string;
  buy: number;
  w: number;
  h: number;
  kind: CargoKind;
  slot: CargoSlot;
  supply?: SupplyKind;
  units?: number;
  note: string;
}

export const CARGO_ITEMS: CargoItem[] = raw as CargoItem[];

export function getCargo(id: string): CargoItem | null {
  return CARGO_ITEMS.find((item) => item.id === id) ?? null;
}

export const CARGO_TABS: { id: CargoTab; label: string; en: string }[] = [
  { id: "pallets", label: "托盘", en: "PALLETS" },
  { id: "crates", label: "货箱", en: "CRATES" },
  { id: "items", label: "物品", en: "ITEMS" },
];

export const SUPPLY_TONE: Record<SupplyKind, string> = {
  build: "bg-muted text-bg",
  ammo: "bg-danger text-red-fg",
  fuel: "bg-zone text-bg",
  mech: "bg-gun text-bg",
};

export interface PackedPlacement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PackedCargo {
  placed: string[];
  leftover: string[];
  cells: (string | null)[][];
  placements: PackedPlacement[];
}

function emptyGrid(w: number, h: number): (string | null)[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => null));
}

function fits(grid: (string | null)[][], x: number, y: number, w: number, h: number): boolean {
  if (y + h > grid.length || x + w > (grid[0]?.length ?? 0)) return false;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (grid[y + j][x + i]) return false;
    }
  }
  return true;
}

function occupy(grid: (string | null)[][], x: number, y: number, w: number, h: number, id: string) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) grid[y + j][x + i] = id;
  }
}

function findSpot(grid: (string | null)[][], w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  const gh = grid.length;
  const gw = grid[0]?.length ?? 0;
  for (const [rw, rh] of [
    [w, h],
    [h, w],
  ] as const) {
    for (let y = 0; y <= gh - rh; y++) {
      for (let x = 0; x <= gw - rw; x++) {
        if (fits(grid, x, y, rw, rh)) return { x, y, w: rw, h: rh };
      }
    }
  }
  return null;
}

export function packBed(bed: BedSpec, ids: string[]): PackedCargo {
  const kit = ids.filter((id) => getCargo(id)?.slot === "kit");
  const bedIds = ids.filter((id) => getCargo(id)?.slot === "bed");
  const leftover: string[] = [];
  const placements: PackedPlacement[] = [];

  if (bed.crateSlots > 0) {
    const placed: string[] = [...kit];
    let slots = 0;
    for (const id of bedIds) {
      const item = getCargo(id);
      if (!item || item.kind !== "crate") {
        leftover.push(id);
        continue;
      }
      if (slots >= bed.crateSlots) {
        leftover.push(id);
        continue;
      }
      placements.push({ id, x: slots, y: 0, w: 1, h: 1 });
      placed.push(id);
      slots += 1;
    }
    return { placed, leftover, cells: emptyGrid(Math.max(bed.crateSlots, 1), 1), placements };
  }

  if (bed.w <= 0 || bed.h <= 0) {
    return { placed: kit, leftover: [...bedIds], cells: [], placements };
  }

  const cells = emptyGrid(bed.w, bed.h);
  const placed: string[] = [...kit];
  for (const id of bedIds) {
    const item = getCargo(id);
    if (!item) {
      leftover.push(id);
      continue;
    }
    const spot = findSpot(cells, item.w, item.h);
    if (!spot) {
      leftover.push(id);
      continue;
    }
    occupy(cells, spot.x, spot.y, spot.w, spot.h, id);
    placements.push({ id, ...spot });
    placed.push(id);
  }
  return { placed, leftover, cells, placements };
}

export function packForVehicle(vehicleId: string, ids: string[]): PackedCargo {
  return packBed(getBed(vehicleId), ids);
}

export interface CargoSummary {
  pallets: number;
  crates: number;
  palletCost: number;
  extraCost: number;
  units: number;
  supplies: Partial<Record<SupplyKind, number>>;
}

export function summarizeCargo(ids: string[]): CargoSummary {
  const summary: CargoSummary = {
    pallets: 0,
    crates: 0,
    palletCost: 0,
    extraCost: 0,
    units: 0,
    supplies: {},
  };
  for (const id of ids) {
    const item = getCargo(id);
    if (!item) continue;
    if (item.kind === "pallet") {
      summary.pallets += 1;
      summary.palletCost += item.buy || PALLET_BUY;
      summary.units += item.units ?? 0;
      if (item.supply) summary.supplies[item.supply] = (summary.supplies[item.supply] ?? 0) + (item.units ?? 0);
    } else {
      summary.extraCost += item.buy;
      if (item.kind === "crate") summary.crates += 1;
    }
  }
  return summary;
}

export function fillPallets(vehicleId: string, count: number, type = "pallet-ammo"): string[] {
  const n = Math.max(0, Math.floor(count));
  return packForVehicle(vehicleId, Array.from({ length: n }, () => type)).placed.filter((id) => getCargo(id)?.kind === "pallet");
}

export function cargoLabel(ids: string[]): string {
  if (!ids.length) return "空斗";
  const counts = new Map<string, number>();
  for (const id of ids) {
    const item = getCargo(id);
    if (!item || item.slot !== "bed") continue;
    counts.set(item.nameZh, (counts.get(item.nameZh) ?? 0) + 1);
  }
  const bits = [...counts.entries()].map(([name, n]) => (n > 1 ? `${name}×${n}` : name));
  const kit = ids.map(getCargo).filter((item) => item?.slot === "kit");
  for (const item of kit) if (item) bits.push(item.nameZh);
  return bits.join(" · ") || "空斗";
}
