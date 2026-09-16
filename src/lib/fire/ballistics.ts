import {
  L81_TABLE,
  SPH2_HIGH,
  SPH2_LOW,
  WEAPONS,
  type RangeMil,
  type WeaponId,
} from "./tables.ts";
import { siteAngleMils } from "./coords.ts";

export type ArcKind = "high" | "low";

export type SolutionStatus = "ok" | "edge" | "too-close" | "out-of-range" | "no-data";

export interface ArcSolution {
  arc: ArcKind;
  mils: number;
  tableMils: number;
  timeOfFlightS: number;
  status: SolutionStatus;
}

export interface FireSolution {
  weapon: WeaponId;
  rangeM: number;
  dH: number;
  azimuthDeg: number | null;
  dirMils: number | null;
  groupingM: number;
  arcs: ArcSolution[];
  status: SolutionStatus;
}

const MOA_TO_M_PER_M = 0.000290888;

function lerpMil(table: readonly RangeMil[], range: number): number | null {
  if (table.length === 0) return null;
  const pts = table.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const rMin = pts[0][0];
  const rMax = pts[pts.length - 1][0];
  if (range < rMin - 0.51 || range > rMax + 0.51) return null;
  if (range <= rMin) return pts[0][1];
  if (range >= rMax) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [r0, m0] = pts[i];
    const [r1, m1] = pts[i + 1];
    if (range >= r0 && range <= r1) {
      if (r1 === r0) return (m0 + m1) / 2;
      return m0 + ((range - r0) / (r1 - r0)) * (m1 - m0);
    }
  }
  return null;
}

/** Mortar hang time grows with elevation (high arc). */
function tofL81(mils: number): number {
  return 4.8 + ((mils - 120) / 830) * 14;
}

/** SPH-2: low arc ~ range/160 s; high arc much longer. */
function tofSph2(mils: number, range: number, arc: ArcKind): number {
  if (arc === "low") return Math.max(6, range / 162);
  return 18 + ((1400 - mils) / 790) * 16;
}

function groupingMeters(rangeM: number, moa: number): number {
  return rangeM * moa * MOA_TO_M_PER_M;
}

function applySite(tableMils: number, rangeM: number, dH: number, minMil: number, maxMil: number) {
  const shifted = tableMils + siteAngleMils(rangeM, dH);
  return Math.min(maxMil, Math.max(minMil, shifted));
}

function l81Status(range: number): SolutionStatus {
  if (range < 80) return "too-close";
  if (range > 697) return "out-of-range";
  if (range < 132 || range > 684) return "edge";
  return "ok";
}

function sphStatus(range: number, arc: ArcKind, hasMil: boolean): SolutionStatus {
  if (!hasMil) {
    if (range < 735) return "too-close";
    return "out-of-range";
  }
  if (arc === "low") {
    if (range < 1181) return "too-close";
    if (range > 2629) return "out-of-range";
    return "ok";
  }
  if (range < 735) return "too-close";
  if (range > 2629) return "out-of-range";
  if (range < 780) return "edge";
  return "ok";
}

export function solveWeapon(
  weapon: WeaponId,
  rangeM: number,
  dH = 0,
  azimuthDeg: number | null = null,
): FireSolution {
  const spec = WEAPONS[weapon];
  const groupingM = groupingMeters(rangeM, spec.groupingMoa);
  const normalizedAzimuth = azimuthDeg == null ? null : ((azimuthDeg % 360) + 360) % 360;
  const dirMils = normalizedAzimuth == null ? null : (normalizedAzimuth / 360) * 6400;
  const arcs: ArcSolution[] = [];

  if (!Number.isFinite(rangeM) || rangeM <= 0) {
    return {
      weapon,
      rangeM,
      dH,
      azimuthDeg: normalizedAzimuth,
      dirMils,
      groupingM: 0,
      arcs: [],
      status: "no-data",
    };
  }

  if (weapon === "l81") {
    const tableMils = lerpMil(L81_TABLE, rangeM);
    const status = l81Status(rangeM);
    if (tableMils != null) {
      const mils = Math.round(applySite(tableMils, rangeM, dH, spec.minMil, spec.maxMil));
      arcs.push({
        arc: "high",
        mils,
        tableMils: Math.round(tableMils),
        timeOfFlightS: tofL81(mils),
        status,
      });
    }
    return {
      weapon,
      rangeM,
      dH,
      azimuthDeg: normalizedAzimuth,
      dirMils,
      groupingM,
      arcs,
      status: arcs[0]?.status ?? status,
    };
  }

  const lowMil = lerpMil(SPH2_LOW, rangeM);
  const highMil = lerpMil(SPH2_HIGH, rangeM);

  if (lowMil != null) {
    const status = sphStatus(rangeM, "low", true);
    const mils = Math.round(applySite(lowMil, rangeM, dH, spec.minMil, spec.maxMil));
    arcs.push({
      arc: "low",
      mils,
      tableMils: Math.round(lowMil),
      timeOfFlightS: tofSph2(mils, rangeM, "low"),
      status,
    });
  }
  if (highMil != null) {
    const status = sphStatus(rangeM, "high", true);
    const mils = Math.round(applySite(highMil, rangeM, dH, spec.minMil, spec.maxMil));
    arcs.push({
      arc: "high",
      mils,
      tableMils: Math.round(highMil),
      timeOfFlightS: tofSph2(mils, rangeM, "high"),
      status,
    });
  }

  let status: SolutionStatus;
  if (arcs.length === 0) {
    status = rangeM < spec.minRange ? "too-close" : "out-of-range";
  } else if (arcs.some((a) => a.status === "ok")) {
    status = "ok";
  } else {
    status = arcs[0].status;
  }

  return {
    weapon,
    rangeM,
    dH,
    azimuthDeg: normalizedAzimuth,
    dirMils,
    groupingM,
    arcs,
    status,
  };
}

export function formatSolutionChat(sol: FireSolution, preferredArc: ArcKind | null = null): string {
  const spec = WEAPONS[sol.weapon];
  const az =
    sol.azimuthDeg == null
      ? "方位 —"
      : `方位 ${sol.azimuthDeg.toFixed(1).padStart(5, "0")}° / ${Math.round(sol.dirMils ?? 0)}密位`;
  const arcs = preferredArc ? sol.arcs.filter((a) => a.arc === preferredArc) : sol.arcs;
  const arcLines = arcs
    .map((a) => {
      const label = a.arc === "low" ? "低弹" : "高弹";
      return `${label} 射角 ${a.mils} 密位  约${a.timeOfFlightS.toFixed(0)}秒`;
    })
    .join("\n");
  const st =
    sol.status === "ok"
      ? ""
      : sol.status === "too-close"
        ? "\n状态 过近"
        : sol.status === "out-of-range"
          ? "\n状态 超射距"
          : sol.status === "edge"
            ? "\n状态 边缘射表，首发校正"
            : "";
  return [
    `【火力诸元】${spec.name}`,
    `距离 ${Math.round(sol.rangeM)} m  高差 ${sol.dH >= 0 ? "+" : ""}${Math.round(sol.dH)} m`,
    az,
    arcLines || "无解",
    `散布 ±${sol.groupingM.toFixed(1)} m`,
    st,
  ]
    .filter(Boolean)
    .join("\n");
}

export function milsPerMeter(weapon: WeaponId, rangeM: number, arc: ArcKind): number {
  const a = lerpMil(weapon === "l81" ? L81_TABLE : arc === "low" ? SPH2_LOW : SPH2_HIGH, rangeM);
  const b = lerpMil(
    weapon === "l81" ? L81_TABLE : arc === "low" ? SPH2_LOW : SPH2_HIGH,
    rangeM + 10,
  );
  if (a == null || b == null) return 0;
  return (b - a) / 10;
}
