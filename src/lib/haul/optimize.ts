import type { Vec } from "../fire/coords.ts";
import type { GameMap } from "../fire/maps.ts";
import { scoreSession, type HaulVehicle, type SessionBreakdown, type TripBreakdown, type TripInput } from "./economy.ts";
import { getHaulDestinations, kmBetween, type HaulStop } from "./routes.ts";

export type LoadMode = "mixed" | "cargo" | "taxi";

/** Mixed load is a fireteam escort, not a 13-seat airliner. */
export const SQUAD_ESCORT = 4;

export interface HaulPlan {
  vehicle: HaulVehicle;
  stop: HaulStop;
  mode: LoadMode;
  roundTrip: boolean;
  session: SessionBreakdown;
  trip: TripBreakdown;
}

export interface OptimizeFlags {
  ownedVehicle: boolean;
  ownedVehicleId?: string | null;
  unloadAtFob: boolean;
  expectSurvive: boolean;
  expectKills: number;
  zoneCenter?: Vec | null;
}

export function loadFor(vehicle: HaulVehicle, mode: LoadMode): { pallets: number; passengers: number } {
  if (mode === "cargo") return { pallets: vehicle.palletSlots, passengers: 0 };
  if (mode === "taxi") return { pallets: 0, passengers: vehicle.passengers };
  return {
    pallets: vehicle.palletSlots,
    passengers: Math.min(vehicle.passengers, SQUAD_ESCORT),
  };
}

export function modeLabel(mode: LoadMode): string {
  if (mode === "cargo") return "纯货";
  if (mode === "taxi") return "纯人";
  return "人货";
}

function spawnOwned(flags: OptimizeFlags, vehicleId: string): boolean {
  if (!flags.ownedVehicle) return false;
  if (!flags.ownedVehicleId) return false;
  return flags.ownedVehicleId === vehicleId;
}

export function optimizeHaul(
  vehicles: HaulVehicle[],
  map: GameMap,
  origin: Vec,
  originId: string | null,
  trips: number,
  flags: OptimizeFlags,
): HaulPlan[] {
  const stops = getHaulDestinations(map, originId, flags.zoneCenter).filter((stop) => kmBetween(origin, stop.pos) > 0.25);
  const plans: HaulPlan[] = [];
  for (const vehicle of vehicles) {
    const modes: LoadMode[] = [];
    if (vehicle.palletSlots > 0) modes.push("cargo");
    if (vehicle.passengers > 0) modes.push("taxi");
    if (vehicle.palletSlots > 0 && vehicle.passengers > 0) modes.push("mixed");
    for (const stop of stops) {
      const distanceKm = kmBetween(origin, stop.pos);
      for (const mode of modes) {
        const load = loadFor(vehicle, mode);
        if (load.pallets + load.passengers <= 0) continue;
        for (const roundTrip of [true, false] as const) {
          const input: TripInput = {
            destKind: stop.destKind,
            distanceKm,
            pallets: load.pallets,
            passengers: load.passengers,
            roundTrip,
            ownedVehicle: spawnOwned(flags, vehicle.id),
            unloadAtFob: flags.unloadAtFob,
            expectSurvive: flags.expectSurvive,
            expectKills: flags.expectKills,
          };
          const session = scoreSession(vehicle, input, trips);
          plans.push({ vehicle, stop, mode, roundTrip, session, trip: session.first });
        }
      }
    }
  }
  return plans.sort(
    (a, b) => b.session.sessionNet - a.session.sessionNet || b.session.sessionPerMin - a.session.sessionPerMin,
  );
}

/** 运输最优：有货优先，不把满座载人当成运货。 */
export function pickBestHaul(plans: HaulPlan[]): HaulPlan | null {
  if (!plans.length) return null;
  const cargo = plans.filter((plan) => plan.trip.palletsLoaded > 0);
  return (cargo.length ? cargo : plans)[0] ?? null;
}

export function pickBestRate(plans: HaulPlan[]): HaulPlan | null {
  if (!plans.length) return null;
  return (
    [...plans].sort(
      (a, b) => b.session.sessionPerMin - a.session.sessionPerMin || b.session.sessionNet - a.session.sessionNet,
    )[0] ?? null
  );
}

export function uniquePlans(plans: HaulPlan[], limit: number): HaulPlan[] {
  const seen = new Set<string>();
  const out: HaulPlan[] = [];
  for (const plan of plans) {
    const key = `${plan.vehicle.id}:${plan.stop.id}:${plan.mode}:${plan.roundTrip ? "rt" : "ow"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(plan);
    if (out.length >= limit) break;
  }
  return out;
}

export function planKey(plan: HaulPlan): string {
  return `${plan.vehicle.id}:${plan.stop.id}:${plan.mode}:${plan.roundTrip ? "rt" : "ow"}`;
}

export function planMatches(
  plan: HaulPlan,
  vehicleId: string,
  destId: string | null,
  roundTrip: boolean,
  pallets: number,
  passengers: number,
): boolean {
  return (
    plan.vehicle.id === vehicleId &&
    plan.stop.id === destId &&
    plan.roundTrip === roundTrip &&
    plan.trip.palletsLoaded === Math.min(pallets, plan.vehicle.palletSlots) &&
    plan.trip.passengersLoaded === Math.min(passengers, plan.vehicle.passengers)
  );
}
