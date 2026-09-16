/** Season 1 logistics payouts, community-recorded. Pallet buy $400, zone drop $2500, FOB unload +$1800. */

export const PALLET_BUY = 400;
export const PALLET_DROP = 2500;
export const PALLET_UNLOAD = 1800;
/** Derived so Ural 85 L / 21 km ≈ $4/km. */
export const FUEL_USD_PER_L = 1;
export const PASSENGER_DROP_GROUND = 375;
export const PASSENGER_DROP_AIR = 750;
export const PASSENGER_SURVIVE = 500;
export const PASSENGER_KILL = 750;
/** Extra minutes per extra tank when the drive is longer than the tank. */
export const REFUEL_MINUTES = 4;
/** Load at HQ + drop/unload at dest, per pallet. */
export const PALLET_HANDLE_MIN = 0.8;
/** Board + drop, per passenger. */
export const PAX_HANDLE_MIN = 0.2;

export type DestKind = "field" | "zone" | "fob";

export interface HaulVehicle {
  id: string;
  nameZh: string;
  price: number;
  speedKmh: number;
  passengers: number;
  palletSlots: number;
  fuelL: number;
  rangeKm: number;
  air: boolean;
}

export interface TripInput {
  destKind: DestKind;
  distanceKm: number;
  pallets: number;
  passengers: number;
  roundTrip: boolean;
  ownedVehicle: boolean;
  unloadAtFob: boolean;
  extraCost?: number;
  expectSurvive: boolean;
  expectKills: number;
}

export interface TripBreakdown {
  vehicleId: string;
  destKind: DestKind;
  distanceKm: number;
  driveKm: number;
  minutes: number;
  handlingMinutes: number;
  spawnCost: number;
  fuelCost: number;
  palletCost: number;
  cost: number;
  extraCost: number;
  palletDrop: number;
  palletUnload: number;
  passengerDrop: number;
  passengerSurvive: number;
  passengerKills: number;
  gross: number;
  net: number;
  restNet: number;
  netPerMin: number;
  palletsLoaded: number;
  passengersLoaded: number;
  breakEvenTrips: number | null;
  refuelStops: number;
  overRange: boolean;
}

export interface SessionBreakdown {
  trips: number;
  first: TripBreakdown;
  rest: TripBreakdown;
  sessionNet: number;
  sessionMinutes: number;
  sessionPerMin: number;
}

export function fuelPerKmUsd(vehicle: HaulVehicle): number {
  if (vehicle.rangeKm <= 0 || vehicle.fuelL <= 0) return 0;
  return (vehicle.fuelL / vehicle.rangeKm) * FUEL_USD_PER_L;
}

export function tanksNeeded(vehicle: HaulVehicle, driveKm: number): number {
  if (vehicle.rangeKm <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, driveKm) / vehicle.rangeKm - 1e-9));
}

export function fillLoad(vehicle: HaulVehicle): { pallets: number; passengers: number } {
  return { pallets: vehicle.palletSlots, passengers: vehicle.passengers };
}

export function handlingMinutesFor(pallets: number, passengers: number): number {
  return pallets * PALLET_HANDLE_MIN + passengers * PAX_HANDLE_MIN;
}

export function scoreTrip(vehicle: HaulVehicle, input: TripInput): TripBreakdown {
  const palletsLoaded = Math.max(0, Math.min(Math.floor(input.pallets), vehicle.palletSlots));
  const passengersLoaded = Math.max(0, Math.min(Math.floor(input.passengers), vehicle.passengers));
  const distanceKm = Math.max(0, input.distanceKm);
  const driveKm = input.roundTrip ? distanceKm * 2 : distanceKm;
  const tanks = tanksNeeded(vehicle, driveKm);
  const refuelStops = Math.max(0, tanks - 1);
  const driveMinutes = vehicle.speedKmh > 0 ? (driveKm / vehicle.speedKmh) * 60 : 0;
  const handlingMinutes = handlingMinutesFor(palletsLoaded, passengersLoaded);
  const minutes = driveMinutes + refuelStops * REFUEL_MINUTES + handlingMinutes;
  const spawnCost = input.ownedVehicle ? 0 : vehicle.price;
  const fuelCost = fuelPerKmUsd(vehicle) * driveKm;
  const extraCost = Math.max(0, input.extraCost ?? 0);
  const palletCost = palletsLoaded * PALLET_BUY;

  const inPay = input.destKind !== "field";
  const palletDrop = inPay ? palletsLoaded * PALLET_DROP : 0;
  const palletUnload = input.destKind === "fob" && input.unloadAtFob ? palletsLoaded * PALLET_UNLOAD : 0;
  const dropEach = vehicle.air ? PASSENGER_DROP_AIR : PASSENGER_DROP_GROUND;
  const passengerDrop = inPay ? passengersLoaded * dropEach : 0;
  const passengerSurvive = inPay && input.expectSurvive ? passengersLoaded * PASSENGER_SURVIVE : 0;
  const passengerKills = inPay ? Math.max(0, input.expectKills) * PASSENGER_KILL : 0;

  const gross = palletDrop + palletUnload + passengerDrop + passengerSurvive + passengerKills;
  const cost = spawnCost + palletCost + fuelCost + extraCost;
  const net = gross - cost;
  const restNet = gross - palletCost - fuelCost - extraCost;
  let breakEvenTrips: number | null = null;
  if (spawnCost <= 0) breakEvenTrips = 1;
  else if (restNet > 0) breakEvenTrips = Math.max(1, Math.ceil(spawnCost / restNet));
  const netPerMin = minutes > 0.05 ? net / minutes : net;

  return {
    vehicleId: vehicle.id,
    destKind: input.destKind,
    distanceKm,
    driveKm,
    minutes,
    handlingMinutes,
    spawnCost,
    fuelCost,
    palletCost,
    extraCost,
    cost,
    palletDrop,
    palletUnload,
    passengerDrop,
    passengerSurvive,
    passengerKills,
    gross,
    net,
    restNet,
    netPerMin,
    palletsLoaded,
    passengersLoaded,
    breakEvenTrips,
    refuelStops,
    overRange: refuelStops > 0,
  };
}

export function scoreSession(vehicle: HaulVehicle, input: TripInput, trips = 3): SessionBreakdown {
  const n = Math.max(1, Math.floor(trips));
  const first = scoreTrip(vehicle, input);
  /** Next HQ run only skips spawn if this truck was driven back. */
  const rest = scoreTrip(vehicle, { ...input, ownedVehicle: input.roundTrip });
  const sessionNet = first.net + rest.net * (n - 1);
  const sessionMinutes = first.minutes + rest.minutes * (n - 1);
  return {
    trips: n,
    first,
    rest,
    sessionNet,
    sessionMinutes,
    sessionPerMin: sessionMinutes > 0.05 ? sessionNet / sessionMinutes : sessionNet,
  };
}

export function compareDestinations(vehicle: HaulVehicle, input: TripInput): TripBreakdown[] {
  const kinds: DestKind[] = ["fob", "zone", "field"];
  return kinds.map((destKind) => scoreTrip(vehicle, { ...input, destKind }));
}

/** Rank haulers using the current load, clamped to each bed. */
export function recommendForLoad(vehicles: HaulVehicle[], input: TripInput, trips = 1): SessionBreakdown[] {
  return vehicles
    .map((vehicle) => scoreSession(vehicle, input, trips))
    .sort((a, b) => b.sessionNet - a.sessionNet || b.sessionPerMin - a.sessionPerMin);
}

/**
 * Rank haulers as if every seat and pallet slot is full.
 * Session net (buy once, run N times) beats a single-trip spawn-cost trap.
 */
export function recommendVehicles(vehicles: HaulVehicle[], input: TripInput, trips = 1): TripBreakdown[] {
  return vehicles
    .map((vehicle) => {
      const load = fillLoad(vehicle);
      const filled = { ...input, pallets: load.pallets, passengers: load.passengers };
      if (trips > 1) {
        const session = scoreSession(vehicle, filled, trips);
        return {
          ...session.first,
          net: session.sessionNet,
          netPerMin: session.sessionPerMin,
          minutes: session.sessionMinutes,
          palletsLoaded: session.first.palletsLoaded,
          passengersLoaded: session.first.passengersLoaded,
        };
      }
      return scoreTrip(vehicle, filled);
    })
    .sort((a, b) => b.net - a.net || b.netPerMin - a.netPerMin);
}

export function bestPlan(vehicle: HaulVehicle, input: TripInput): { dest: DestKind; trip: TripBreakdown } {
  const ranked = compareDestinations(vehicle, input);
  const trip = ranked[0];
  return { dest: trip.destKind, trip };
}

export function recommendSessions(vehicles: HaulVehicle[], input: TripInput, trips = 3): SessionBreakdown[] {
  return vehicles
    .map((vehicle) => {
      const load = fillLoad(vehicle);
      return scoreSession(vehicle, { ...input, pallets: load.pallets, passengers: load.passengers }, trips);
    })
    .sort((a, b) => b.sessionNet - a.sessionNet || b.sessionPerMin - a.sessionPerMin);
}
