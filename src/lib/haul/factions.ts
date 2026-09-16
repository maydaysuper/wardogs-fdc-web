export type FobId = "valkyra" | "lonestar" | "manticore";

export interface Faction {
  id: FobId;
  nameZh: string;
  nameEn: string;
  nameShort: string;
  hex: string;
  fill: string;
  chipOn: string;
  chipOff: string;
  dot: string;
}

/** Battlefield colours: VALKYRA red, LONESTAR blue, MANTICORE green. */
export const FACTIONS: Record<FobId, Faction> = {
  valkyra: {
    id: "valkyra",
    nameZh: "红方",
    nameEn: "VALKYRA",
    nameShort: "红",
    hex: "#e23d35",
    fill: "rgb(226 61 53 / 0.18)",
    chipOn: "bg-red text-red-fg",
    chipOff: "bg-hud-2 text-fg hover:bg-fg/10",
    dot: "bg-red",
  },
  lonestar: {
    id: "lonestar",
    nameZh: "蓝方",
    nameEn: "LONESTAR",
    nameShort: "蓝",
    hex: "#3b82f6",
    fill: "rgb(59 130 246 / 0.18)",
    chipOn: "bg-blue text-blue-fg",
    chipOff: "bg-hud-2 text-fg hover:bg-fg/10",
    dot: "bg-blue",
  },
  manticore: {
    id: "manticore",
    nameZh: "绿方",
    nameEn: "MANTICORE",
    nameShort: "绿",
    hex: "#22a85b",
    fill: "rgb(34 168 91 / 0.18)",
    chipOn: "bg-green text-green-fg",
    chipOff: "bg-hud-2 text-fg hover:bg-fg/10",
    dot: "bg-green",
  },
};

/** 红 · 蓝 · 绿 */
export const FACTION_ORDER: FobId[] = ["valkyra", "lonestar", "manticore"];

export function factionOf(id: string | null | undefined): Faction | null {
  if (id === "valkyra" || id === "lonestar" || id === "manticore") return FACTIONS[id];
  return null;
}
