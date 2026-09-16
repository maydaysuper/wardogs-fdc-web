import { distanceMeters, type Vec } from "../fire/coords.ts";
import { MAPS, getTowerMarkers, type GameMap, type MapId, type MapMarker } from "../fire/maps.ts";
import { FACTION_ORDER, FACTIONS, type FobId } from "./factions.ts";
import {
  scoreSession,
  scoreTrip,
  type DestKind,
  type HaulVehicle,
  type SessionBreakdown,
  type TripBreakdown,
  type TripInput,
} from "./economy.ts";

export type { FobId };

export interface HaulStop {
  id: string;
  fobId?: FobId;
  label: string;
  short: string;
  pos: Vec;
  destKind: DestKind;
}

export const FRONT_FOB_ID = "front-fob";

export function polygonCenter(points: Vec[]): Vec {
  const n = Math.max(1, points.length);
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / n,
    y: points.reduce((sum, p) => sum + p.y, 0) / n,
  };
}

export function fobIdOf(marker: MapMarker): FobId | null {
  if (marker.kind === "valkyra" || marker.kind === "manticore" || marker.kind === "lonestar") return marker.kind;
  return null;
}

export function getFobStops(map: GameMap): HaulStop[] {
  const stops: HaulStop[] = [];
  for (const marker of map.markers) {
    const fobId = fobIdOf(marker);
    if (!fobId) continue;
    const faction = FACTIONS[fobId];
    stops.push({
      id: `fob-${fobId}`,
      fobId,
      label: `${faction.nameZh} ${faction.nameEn}`,
      short: faction.nameZh,
      pos: marker.pos,
      destKind: "fob",
    });
  }
  return stops.sort((a, b) => FACTION_ORDER.indexOf(a.fobId!) - FACTION_ORDER.indexOf(b.fobId!));
}

export function getTowerStops(map: GameMap): HaulStop[] {
  return getTowerMarkers(map).map((marker) => ({
    id: `tower-${marker.label}`,
    label: marker.label,
    short: marker.label.replace("塔 ", "T"),
    pos: marker.pos,
    destKind: "zone" as const,
  }));
}

/** Control-zone cluster: where a team actually plants a FOB. */
export function towerCluster(map: GameMap): Vec {
  const towers = getTowerMarkers(map);
  if (!towers.length) return { x: 80, y: 80 };
  return polygonCenter(towers.map((tower) => tower.pos));
}

/** Field FOB on the current Control Zone — not another faction's spawn HQ. */
export function getFrontStop(map: GameMap, zoneCenter?: Vec | null): HaulStop {
  return {
    id: FRONT_FOB_ID,
    label: "前线 FOB",
    short: "前线FOB",
    pos: zoneCenter ?? towerCluster(map),
    destKind: "fob",
  };
}

/** Unload targets that exist in-game: friendly field FOB + zone towers. Never enemy HQs. */
export function getHaulDestinations(map: GameMap, originId: string | null, zoneCenter?: Vec | null): HaulStop[] {
  const front = getFrontStop(map, zoneCenter);
  return [front, ...getTowerStops(map)].filter((stop) => {
    if (originId && stop.id === originId) return false;
    return true;
  });
}

export function allStops(map: GameMap, zoneCenter?: Vec | null): HaulStop[] {
  return [...getFobStops(map), getFrontStop(map, zoneCenter), ...getTowerStops(map)];
}

export function defaultHaulRoute(map: GameMap, zoneCenter?: Vec | null, originId?: string | null): { origin: HaulStop; dest: HaulStop } {
  const fobs = getFobStops(map);
  const origin =
    (originId ? fobs.find((stop) => stop.id === originId) : null) ??
    fobs.find((stop) => stop.fobId === "lonestar") ??
    fobs[0];
  const dest = getFrontStop(map, zoneCenter);
  return { origin, dest };
}

export function defaultHaulRouteFor(mapId: MapId, zoneCenter?: Vec | null, originId?: string | null) {
  return defaultHaulRoute(MAPS[mapId], zoneCenter, originId);
}

export function matchStop(map: GameMap, pos: Vec, maxMeters = 80, zoneCenter?: Vec | null): HaulStop | null {
  let best: HaulStop | null = null;
  let bestM = maxMeters;
  for (const stop of allStops(map, zoneCenter)) {
    const d = distanceMeters(pos, stop.pos);
    if (d <= bestM) {
      bestM = d;
      best = stop;
    }
  }
  return best;
}

export function kmBetween(a: Vec, b: Vec): number {
  return distanceMeters(a, b) / 1000;
}

export interface RankedRoute {
  stop: HaulStop;
  distanceKm: number;
  trip: TripBreakdown;
  session: SessionBreakdown;
}

export function rankRoutes(
  map: GameMap,
  origin: Vec,
  originId: string | null,
  vehicle: HaulVehicle,
  input: Omit<TripInput, "distanceKm" | "destKind"> & { destKind?: DestKind },
  trips = 3,
  zoneCenter?: Vec | null,
): RankedRoute[] {
  const candidates = getHaulDestinations(map, originId, zoneCenter).filter((stop) => kmBetween(origin, stop.pos) > 0.25);
  return candidates
    .map((stop) => {
      const distanceKm = kmBetween(origin, stop.pos);
      const tripInput: TripInput = { ...input, distanceKm, destKind: stop.destKind };
      return {
        stop,
        distanceKm,
        trip: scoreTrip(vehicle, tripInput),
        session: scoreSession(vehicle, tripInput, trips),
      };
    })
    .sort((a, b) => b.session.sessionNet - a.session.sessionNet || b.trip.netPerMin - a.trip.netPerMin);
}

export function bestVehicleOnRoute(
  vehicles: HaulVehicle[],
  origin: Vec,
  dest: Vec,
  destKind: DestKind,
  input: Omit<TripInput, "distanceKm" | "destKind">,
  trips = 3,
): SessionBreakdown[] {
  const distanceKm = kmBetween(origin, dest);
  return vehicles
    .map((vehicle) =>
      scoreSession(
        vehicle,
        {
          ...input,
          distanceKm,
          destKind,
          pallets: vehicle.palletSlots,
          passengers: vehicle.passengers,
        },
        trips,
      ),
    )
    .sort((a, b) => b.sessionNet - a.sessionNet || b.sessionPerMin - a.sessionPerMin);
}
