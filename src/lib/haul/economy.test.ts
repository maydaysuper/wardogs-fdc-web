import assert from "node:assert/strict";
import test from "node:test";
import {
  PALLET_BUY,
  PALLET_DROP,
  PALLET_UNLOAD,
  PALLET_HANDLE_MIN,
  PASSENGER_DROP_GROUND,
  PASSENGER_SURVIVE,
  REFUEL_MINUTES,
  bestPlan,
  compareDestinations,
  handlingMinutesFor,
  recommendForLoad,
  recommendVehicles,
  scoreSession,
  scoreTrip,
  tanksNeeded,
  type HaulVehicle,
} from "./economy.ts";

const ural: HaulVehicle = {
  id: "ural",
  nameZh: "乌拉尔",
  price: 5000,
  speedKmh: 79,
  passengers: 3,
  palletSlots: 2,
  fuelL: 85,
  rangeKm: 21,
  air: false,
};

const lakota: HaulVehicle = {
  id: "lakota",
  nameZh: "拉科塔",
  price: 7400,
  speedKmh: 445,
  passengers: 13,
  palletSlots: 1,
  fuelL: 120,
  rangeKm: 27,
  air: true,
};

const pickup: HaulVehicle = {
  id: "kodiak-pickup",
  nameZh: "科迪亚克皮卡",
  price: 3000,
  speedKmh: 154,
  passengers: 6,
  palletSlots: 0,
  fuelL: 50,
  rangeKm: 17,
  air: false,
};

const base = {
  destKind: "fob" as const,
  distanceKm: 10,
  pallets: 2,
  passengers: 2,
  roundTrip: true,
  ownedVehicle: false,
  unloadAtFob: true,
  expectSurvive: true,
  expectKills: 0,
};

test("field dump pays nothing on cargo or seats", () => {
  const trip = scoreTrip(ural, { ...base, destKind: "field" });
  assert.equal(trip.palletDrop, 0);
  assert.equal(trip.palletUnload, 0);
  assert.equal(trip.passengerDrop, 0);
  assert.equal(trip.gross, 0);
  assert.ok(trip.net < 0);
});

test("zone drop is $2500 per pallet and no FOB unload", () => {
  const trip = scoreTrip(ural, { ...base, destKind: "zone", unloadAtFob: true });
  assert.equal(trip.palletsLoaded, 2);
  assert.equal(trip.palletDrop, 2 * PALLET_DROP);
  assert.equal(trip.palletUnload, 0);
  assert.equal(trip.palletCost, 2 * PALLET_BUY);
});

test("FOB unload adds $1800 per pallet on top of the drop", () => {
  const trip = scoreTrip(ural, base);
  assert.equal(trip.palletDrop, 5000);
  assert.equal(trip.palletUnload, 2 * PALLET_UNLOAD);
  assert.equal(trip.passengerDrop, 2 * PASSENGER_DROP_GROUND);
  assert.equal(trip.passengerSurvive, 2 * PASSENGER_SURVIVE);
});

test("owned vehicle skips spawn; Ural fuel is about $4/km", () => {
  const bought = scoreTrip(ural, { ...base, ownedVehicle: true, pallets: 0, passengers: 0, expectSurvive: false });
  assert.equal(bought.spawnCost, 0);
  assert.ok(Math.abs(bought.fuelCost - 20 * (85 / 21)) < 1e-6);
  const first = scoreTrip(ural, { ...base, ownedVehicle: false, pallets: 0, passengers: 0, expectSurvive: false });
  assert.equal(first.spawnCost, 5000);
});

test("pallets and seats clamp to the bed, not the wish list", () => {
  const trip = scoreTrip(ural, { ...base, pallets: 8, passengers: 8 });
  assert.equal(trip.palletsLoaded, 2);
  assert.equal(trip.passengersLoaded, 3);
});

test("FOB beats zone beats field for a full Ural", () => {
  const [fob, zone, field] = compareDestinations(ural, base);
  assert.equal(fob.destKind, "fob");
  assert.ok(fob.net > zone.net);
  assert.ok(zone.net > field.net);
  assert.equal(bestPlan(ural, base).dest, "fob");
});

test("break-even is ceil(spawn / rest net)", () => {
  const trip = scoreTrip(ural, { ...base, ownedVehicle: false });
  assert.ok(trip.breakEvenTrips && trip.breakEvenTrips >= 1);
  const owned = scoreTrip(ural, { ...base, ownedVehicle: true });
  assert.equal(owned.breakEvenTrips, 1);
});

test("recommend ranks Lakota above Ural on a long FOB run when seats fill", () => {
  const ranked = recommendVehicles([ural, lakota, pickup], { ...base, distanceKm: 12 });
  assert.equal(ranked[0].vehicleId, "lakota");
  const lakotaTrip = ranked.find((t) => t.vehicleId === "lakota")!;
  const uralTrip = ranked.find((t) => t.vehicleId === "ural")!;
  assert.ok(lakotaTrip.net > uralTrip.net);
  assert.ok(lakotaTrip.minutes < uralTrip.minutes);
});

test("session net is first trip plus (n-1) return trips", () => {
  const session = scoreSession(ural, base, 3);
  assert.equal(session.trips, 3);
  assert.equal(session.first.spawnCost, 5000);
  assert.equal(session.rest.spawnCost, 0);
  assert.ok(Math.abs(session.sessionNet - (session.first.net + session.rest.net * 2)) < 1e-6);
  assert.ok(session.sessionNet > session.first.net);
});

test("one-way rest trips still pay spawn because the truck is not at HQ", () => {
  const session = scoreSession(ural, { ...base, roundTrip: false }, 3);
  assert.equal(session.rest.spawnCost, 5000);
});

test("over-range drive adds refuel minutes", () => {
  const empty = { ...base, pallets: 0, passengers: 0, expectSurvive: false };
  const short = scoreTrip(ural, { ...empty, distanceKm: 5, roundTrip: true });
  assert.equal(short.refuelStops, 0);
  assert.equal(tanksNeeded(ural, 10), 1);
  const long = scoreTrip(ural, { ...empty, distanceKm: 20, roundTrip: true });
  assert.ok(long.overRange);
  assert.equal(long.refuelStops, 1);
  const driveMin = (40 / 79) * 60;
  assert.ok(Math.abs(long.minutes - (driveMin + REFUEL_MINUTES)) < 1e-6);
});

test("handling time is load plus drop, once per trip even on a round trip", () => {
  const trip = scoreTrip(ural, { ...base, pallets: 2, passengers: 0, expectSurvive: false });
  assert.equal(trip.handlingMinutes, 2 * PALLET_HANDLE_MIN);
  assert.equal(handlingMinutesFor(2, 3), 2 * PALLET_HANDLE_MIN + 3 * 0.2);
});

test("current-load ranking prefers cheaper spawn when seats stay empty", () => {
  const twoSeats = { ...base, pallets: 2, passengers: 2, distanceKm: 5 };
  const ranked = recommendForLoad([ural, lakota], twoSeats, 1);
  assert.equal(ranked[0].first.vehicleId, "ural");
  const full = recommendVehicles([ural, lakota], twoSeats, 1);
  assert.equal(full[0].vehicleId, "lakota");
});
