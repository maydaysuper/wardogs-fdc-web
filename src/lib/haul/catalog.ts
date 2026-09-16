import raw from "../../config/haul/vehicles.json" with { type: "json" };
import type { HaulVehicle } from "./economy.ts";

type Row = (typeof raw)[number];

export interface BedSpec {
  fuelL: number;
  rangeKm: number;
  palletSlots: number;
  w: number;
  h: number;
  crateSlots: number;
}

const SPECS: Record<string, BedSpec> = {
  bobcat: { fuelL: 18, rangeKm: 8, palletSlots: 0, w: 0, h: 0, crateSlots: 0 },
  "dune-buggy": { fuelL: 68, rangeKm: 14, palletSlots: 0, w: 0, h: 0, crateSlots: 0 },
  kodiak: { fuelL: 50, rangeKm: 17, palletSlots: 0, w: 4, h: 1, crateSlots: 0 },
  "kodiak-pickup": { fuelL: 50, rangeKm: 17, palletSlots: 0, w: 4, h: 1, crateSlots: 0 },
  humvee: { fuelL: 65, rangeKm: 20, palletSlots: 0, w: 4, h: 1, crateSlots: 0 },
  "kodiak-m249": { fuelL: 50, rangeKm: 17, palletSlots: 0, w: 4, h: 1, crateSlots: 0 },
  "humvee-m249": { fuelL: 65, rangeKm: 20, palletSlots: 0, w: 4, h: 1, crateSlots: 0 },
  "humvee-minigun": { fuelL: 65, rangeKm: 20, palletSlots: 0, w: 4, h: 1, crateSlots: 0 },
  ural: { fuelL: 85, rangeKm: 21, palletSlots: 2, w: 8, h: 2, crateSlots: 0 },
  "ural-defender": { fuelL: 85, rangeKm: 21, palletSlots: 2, w: 8, h: 2, crateSlots: 0 },
  "ural-defender-m249": { fuelL: 85, rangeKm: 21, palletSlots: 2, w: 8, h: 2, crateSlots: 0 },
  mh6: { fuelL: 105, rangeKm: 24, palletSlots: 0, w: 0, h: 0, crateSlots: 2 },
  ah6m: { fuelL: 105, rangeKm: 24, palletSlots: 0, w: 0, h: 0, crateSlots: 0 },
  lakota: { fuelL: 120, rangeKm: 27, palletSlots: 1, w: 4, h: 2, crateSlots: 0 },
  "lakota-miniguns": { fuelL: 120, rangeKm: 27, palletSlots: 1, w: 4, h: 2, crateSlots: 0 },
  ah6r: { fuelL: 105, rangeKm: 24, palletSlots: 0, w: 0, h: 0, crateSlots: 0 },
  havoc: { fuelL: 130, rangeKm: 30, palletSlots: 0, w: 0, h: 0, crateSlots: 0 },
  "sph-2": { fuelL: 105, rangeKm: 13, palletSlots: 0, w: 0, h: 0, crateSlots: 0 },
  gepard: { fuelL: 105, rangeKm: 13, palletSlots: 0, w: 0, h: 0, crateSlots: 0 },
  l2a6: { fuelL: 110, rangeKm: 14, palletSlots: 0, w: 0, h: 0, crateSlots: 0 },
};

export const NAME_EN: Record<string, string> = {
  bobcat: "BOBCAT",
  "dune-buggy": "DUNE BUGGY",
  kodiak: "KODIAK",
  "kodiak-pickup": "KODIAK [PICKUP]",
  humvee: "HUMVEE",
  "kodiak-m249": "KODIAK [M249]",
  "humvee-m249": "HUMVEE [M249]",
  "humvee-minigun": "HUMVEE [MINIGUN]",
  ural: "URAL",
  "ural-defender": "URAL DEFENDER",
  "ural-defender-m249": "URAL DEFENDER [M249]",
  mh6: "MH-6",
  ah6m: "AH-6M [MINIGUNS]",
  lakota: "Z20 LAKOTA",
  "lakota-miniguns": "Z20 LAKOTA [MINIGUNS]",
  ah6r: "AH-6R [ROCKETS]",
  havoc: "HAVOC",
  "sph-2": "SPH-2",
  gepard: "FLAKPANZER GEPARD",
  l2a6: "L2A6",
};

export function getBed(id: string): BedSpec {
  return SPECS[id] ?? { fuelL: 50, rangeKm: 16, palletSlots: 0, w: 0, h: 0, crateSlots: 0 };
}

export function toHaulVehicle(row: Row): HaulVehicle {
  const spec = getBed(row.id);
  return {
    id: row.id,
    nameZh: row.nameZh,
    price: row.price,
    speedKmh: row.speedKmh,
    passengers: row.passengers,
    palletSlots: spec.palletSlots,
    fuelL: spec.fuelL,
    rangeKm: spec.rangeKm,
    air: row.air,
  };
}

export const HAUL_VEHICLES: HaulVehicle[] = raw.map(toHaulVehicle);

export function getHaulVehicle(id: string): HaulVehicle {
  return HAUL_VEHICLES.find((v) => v.id === id) ?? HAUL_VEHICLES.find((v) => v.id === "ural")!;
}

export function getVendorRow(id: string): Row {
  return raw.find((row) => row.id === id) ?? raw.find((row) => row.id === "ural")!;
}

export function isHauler(row: Row, vehicle: HaulVehicle): boolean {
  if (row.group === "armor") return false;
  if (row.group === "air-combat" && vehicle.palletSlots === 0) return false;
  return vehicle.passengers >= 2 || vehicle.palletSlots > 0;
}

export const HAULER_OPTIONS: HaulVehicle[] = raw
  .map((row) => ({ row, vehicle: toHaulVehicle(row) }))
  .filter(({ row, vehicle }) => isHauler(row, vehicle))
  .map(({ vehicle }) => vehicle);

export const VENDOR_ROWS: Row[] = raw;

export type VendorTab = "land" | "air";
export type VendorFilter = "all" | "transport" | "tank" | "artillery" | "combat";

export const VENDOR_TABS: { id: VendorTab; label: string; en: string }[] = [
  { id: "land", label: "陆地", en: "LAND" },
  { id: "air", label: "空中", en: "AIR" },
];

export const LAND_FILTERS: { id: VendorFilter; en: string; label: string }[] = [
  { id: "all", en: "ALL", label: "全部" },
  { id: "transport", en: "TRANSPORT", label: "运输" },
  { id: "tank", en: "TANK", label: "坦克" },
  { id: "artillery", en: "ARTILLERY", label: "火炮" },
];

export const AIR_FILTERS: { id: VendorFilter; en: string; label: string }[] = [
  { id: "all", en: "ALL", label: "全部" },
  { id: "transport", en: "TRANSPORT", label: "运输" },
  { id: "combat", en: "COMBAT", label: "武装" },
];

export function isAirRow(row: Row): boolean {
  return row.group === "air" || row.group === "air-combat";
}

export function vendorTabOf(id: string): VendorTab {
  return isAirRow(getVendorRow(id)) ? "air" : "land";
}

export function matchesVendor(row: Row, tab: VendorTab, filter: VendorFilter): boolean {
  if (tab === "air") {
    if (!isAirRow(row)) return false;
    if (filter === "transport") return row.group === "air";
    if (filter === "combat") return row.group === "air-combat";
    return true;
  }
  if (isAirRow(row)) return false;
  if (filter === "transport") return row.group === "land" || row.group === "armed" || row.group === "logistics";
  if (filter === "tank") return row.id === "l2a6" || row.id === "gepard";
  if (filter === "artillery") return row.id === "sph-2";
  return true;
}

export function classLabel(row: Row): { en: string; zh: string } {
  if (row.group === "air") return { en: "Air · Transport", zh: "空运" };
  if (row.group === "air-combat") return { en: "Air · Combat", zh: "武装直升机" };
  if (row.id === "sph-2") return { en: "Land · Artillery", zh: "自行火炮" };
  if (row.group === "armor") return { en: "Land · Tank", zh: "装甲" };
  if (row.group === "logistics") return { en: "Land · Transport", zh: "后勤卡车" };
  if (row.group === "armed") return { en: "Land · Transport", zh: "武装轮式" };
  return { en: "Land · Transport", zh: "陆地运输" };
}

export const VENDOR_SECTIONS: { group: Row["group"]; label: string; en: string }[] = [
  { group: "land", label: "陆地运输", en: "LAND TRANSPORT" },
  { group: "armed", label: "武装轮式", en: "ARMED TRANSPORT" },
  { group: "logistics", label: "后勤卡车", en: "LOGISTICS" },
  { group: "air", label: "空运", en: "AIR TRANSPORT" },
  { group: "air-combat", label: "武装直升机", en: "COMBAT HELICOPTERS" },
  { group: "armor", label: "装甲 / 火炮", en: "ARMOR / ARTILLERY" },
];
