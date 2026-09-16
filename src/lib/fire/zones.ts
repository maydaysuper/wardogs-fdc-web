import type { Vec } from "./coords.ts";
import { METERS_PER_UNIT, distanceMeters } from "./coords.ts";
import type { GameMap, MapId, MapMarker } from "./maps.ts";
import { getTowerMarkers } from "./maps.ts";

/**
 * BETA 2 community map data models the playable Control Zone as a circle.
 * Most published placements are ~1 km across; Europe/Paris Default is
 * explicitly documented as 1.1 km across.  The center is match-dependent,
 * so the tool stores the currently observed center separately from static map data.
 */
export const DEFAULT_CONTROL_ZONE_DIAMETER_METERS = 1000;

export type ControlZonePlacementStatus = "active" | "never-rolled";

export interface ControlZonePlacement {
  id: string;
  label: string;
  region: string;
  diameterM: number;
  status: ControlZonePlacementStatus;
  note?: string;
}

export const CONTROL_ZONE_CATALOG: Record<MapId, readonly ControlZonePlacement[]> = {
  bakurani: [
    { id: "bakurani-default", label: "Default", region: "Bakurani", diameterM: 1000, status: "active" },
    { id: "bakurani-farmland", label: "Farmland", region: "Bakurani", diameterM: 1000, status: "active" },
    { id: "bakurani-lumberyard", label: "Lumberyard", region: "Bakurani", diameterM: 1000, status: "active" },
  ],
  ozeti: [
    { id: "madrid-default", label: "Default", region: "Madrid", diameterM: 1000, status: "active" },
    { id: "madrid-farmland", label: "Farmland", region: "Madrid", diameterM: 1000, status: "active" },
    { id: "madrid-church", label: "Church", region: "Madrid", diameterM: 1000, status: "active" },
    { id: "madrid-river", label: "River", region: "Madrid", diameterM: 1000, status: "active" },
    {
      id: "paris-default",
      label: "Default",
      region: "Paris",
      diameterM: 1100,
      status: "active",
      note: "Paris placement is documented as a 1.1 km circle.",
    },
  ],
  zestafona: [
    { id: "detroit-default", label: "Default", region: "Detroit", diameterM: 1000, status: "active" },
    {
      id: "detroit-small-factory",
      label: "Small Factory",
      region: "Detroit",
      diameterM: 1000,
      status: "never-rolled",
      note: "BETA 2 keeps this placement on the map but it is not rolled in live matches.",
    },
    { id: "detroit-water-treatment", label: "Water Treatment", region: "Detroit", diameterM: 1000, status: "active" },
    {
      id: "detroit-houses",
      label: "Houses",
      region: "Detroit",
      diameterM: 1000,
      status: "active",
      note: "BETA 2 moved this circle 244 m east; calibrate against the current in-game center.",
    },
  ],
};

export const CONTROL_ZONE_CALIBRATION_VERIFIED_AT = "2026-09-15";

export function getZonePlacements(mapId: MapId): readonly ControlZonePlacement[] {
  return CONTROL_ZONE_CATALOG[mapId];
}

export function getZonePlacement(mapId: MapId, id: string | null | undefined): ControlZonePlacement | null {
  if (!id) return null;
  return CONTROL_ZONE_CATALOG[mapId].find((placement) => placement.id === id) ?? null;
}

export function zoneDiameterMeters(mapId: MapId, placementId?: string | null): number {
  return getZonePlacement(mapId, placementId)?.diameterM ?? DEFAULT_CONTROL_ZONE_DIAMETER_METERS;
}

export function zoneRadiusUnits(diameterM: number): number {
  return Math.max(1, diameterM) / 2 / METERS_PER_UNIT;
}

export interface ControlZoneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function controlZoneBounds(
  center: Vec,
  diameterM = DEFAULT_CONTROL_ZONE_DIAMETER_METERS,
): ControlZoneBounds {
  const r = zoneRadiusUnits(diameterM);
  return { minX: center.x - r, maxX: center.x + r, minY: center.y - r, maxY: center.y + r };
}

export function isPointInControlZone(
  point: Vec,
  center: Vec,
  diameterM = DEFAULT_CONTROL_ZONE_DIAMETER_METERS,
  epsilonM = 0.001,
): boolean {
  return distanceMeters(point, center) <= diameterM / 2 + epsilonM;
}

/** Distance to the circular zone boundary. Returns 0 for a point inside it. */
export function distanceToControlZoneMeters(
  point: Vec,
  center: Vec,
  diameterM = DEFAULT_CONTROL_ZONE_DIAMETER_METERS,
): number {
  return Math.max(0, distanceMeters(point, center) - diameterM / 2);
}

export function getTowersInControlZone(
  map: GameMap,
  center: Vec,
  diameterM = DEFAULT_CONTROL_ZONE_DIAMETER_METERS,
): MapMarker[] {
  return getTowerMarkers(map).filter((tower) => isPointInControlZone(tower.pos, center, diameterM));
}

export function getNearestTowerToControlZone(
  map: GameMap,
  center: Vec,
  diameterM = DEFAULT_CONTROL_ZONE_DIAMETER_METERS,
): { tower: MapMarker; distanceToZoneM: number; distanceToCenterM: number } | null {
  const towers = getTowerMarkers(map);
  if (towers.length === 0) return null;

  let best = towers[0];
  let bestToZone = distanceToControlZoneMeters(best.pos, center, diameterM);
  let bestToCenter = distanceMeters(best.pos, center);

  for (const tower of towers.slice(1)) {
    const toZone = distanceToControlZoneMeters(tower.pos, center, diameterM);
    const toCenter = distanceMeters(tower.pos, center);
    if (toZone < bestToZone || (Math.abs(toZone - bestToZone) < 1e-6 && toCenter < bestToCenter)) {
      best = tower;
      bestToZone = toZone;
      bestToCenter = toCenter;
    }
  }

  return { tower: best, distanceToZoneM: bestToZone, distanceToCenterM: bestToCenter };
}
