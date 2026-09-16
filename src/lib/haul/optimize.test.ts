import assert from "node:assert/strict";
import test from "node:test";
import { MAPS } from "../fire/maps.ts";
import { PALLET_BUY, PALLET_DROP, PALLET_UNLOAD, scoreSession, type HaulVehicle } from "./economy.ts";
import { HAULER_OPTIONS, getHaulVehicle } from "./catalog.ts";
import { FRONT_FOB_ID, defaultHaulRoute, kmBetween } from "./routes.ts";
import { loadFor, optimizeHaul, pickBestHaul, pickBestRate } from "./optimize.ts";

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

test("Lakota bed is 4×2 so one pallet, Ural 8×2 is two", () => {
  assert.equal(getHaulVehicle("lakota").palletSlots, 1);
  assert.equal(getHaulVehicle("ural").palletSlots, 2);
  assert.equal(getHaulVehicle("mh6").palletSlots, 0);
  assert.equal(getHaulVehicle("kodiak-pickup").palletSlots, 0);
});

test("one-way sessions buy the truck again; round trip keeps it", () => {
  const flags = {
    destKind: "fob" as const,
    distanceKm: 8,
    pallets: 2,
    passengers: 0,
    ownedVehicle: false,
    unloadAtFob: true,
    expectSurvive: false,
    expectKills: 0,
  };
  const loop = scoreSession(ural, { ...flags, roundTrip: true }, 3);
  const dump = scoreSession(ural, { ...flags, roundTrip: false }, 3);
  assert.equal(loop.rest.spawnCost, 0);
  assert.equal(dump.rest.spawnCost, 5000);
  assert.ok(loop.sessionNet > dump.sessionNet);
});

test("optimize picks 前线 FOB pallet run over dumping at a tower", () => {
  const map = MAPS.bakurani;
  const { origin } = defaultHaulRoute(map);
  const ranked = optimizeHaul(HAULER_OPTIONS, map, origin.pos, origin.id, 3, {
    ownedVehicle: false,
    unloadAtFob: true,
    expectSurvive: false,
    expectKills: 0,
  });
  assert.ok(ranked.length > 8);
  const best = pickBestHaul(ranked);
  assert.ok(best);
  assert.equal(best.stop.id, FRONT_FOB_ID);
  assert.equal(best.stop.destKind, "fob");
  assert.equal(best.roundTrip, true);
  assert.ok(best.trip.palletsLoaded >= 1);
  assert.ok(best.session.sessionNet > 0);
  assert.equal(ranked.some((plan) => plan.stop.id.startsWith("fob-")), false);
  const tower = ranked.find((plan) => plan.stop.destKind === "zone" && plan.vehicle.id === best.vehicle.id);
  assert.ok(tower);
  assert.ok(best.session.sessionNet >= tower.session.sessionNet);
});

test("haul pick ignores full-seat taxi even if that cash is higher", () => {
  const map = MAPS.bakurani;
  const { origin } = defaultHaulRoute(map);
  const ranked = optimizeHaul(HAULER_OPTIONS, map, origin.pos, origin.id, 3, {
    ownedVehicle: false,
    unloadAtFob: true,
    expectSurvive: true,
    expectKills: 0,
  });
  const bestHaul = pickBestHaul(ranked);
  const bestCash = ranked[0];
  assert.ok(bestHaul);
  assert.ok(bestHaul.trip.palletsLoaded >= 1);
  assert.ok(bestHaul.mode !== "taxi");
  if (bestCash.mode === "taxi") {
    assert.ok(bestCash.session.sessionNet >= bestHaul.session.sessionNet);
  }
});

test("车已买 only waives spawn on that vehicle", () => {
  const map = MAPS.bakurani;
  const { origin } = defaultHaulRoute(map);
  const owned = optimizeHaul([getHaulVehicle("ural"), getHaulVehicle("lakota")], map, origin.pos, origin.id, 3, {
    ownedVehicle: true,
    ownedVehicleId: "ural",
    unloadAtFob: true,
    expectSurvive: false,
    expectKills: 0,
  });
  const uralPlan = owned.find((plan) => plan.vehicle.id === "ural" && plan.roundTrip && plan.mode === "cargo");
  const lakotaPlan = owned.find((plan) => plan.vehicle.id === "lakota" && plan.roundTrip && plan.mode === "cargo");
  assert.ok(uralPlan);
  assert.ok(lakotaPlan);
  assert.equal(uralPlan.trip.spawnCost, 0);
  assert.equal(lakotaPlan.trip.spawnCost, 7400);
});

test("Ural two-pallet FOB math matches the recorded drop + unload", () => {
  const trip = scoreSession(
    ural,
    {
      destKind: "fob",
      distanceKm: 8,
      pallets: 2,
      passengers: 0,
      roundTrip: true,
      ownedVehicle: false,
      unloadAtFob: true,
      expectSurvive: false,
      expectKills: 0,
    },
    1,
  ).first;
  assert.equal(trip.palletCost, 2 * PALLET_BUY);
  assert.equal(trip.palletDrop, 2 * PALLET_DROP);
  assert.equal(trip.palletUnload, 2 * PALLET_UNLOAD);
  assert.equal(trip.spawnCost, 5000);
  assert.equal(trip.gross - trip.palletCost, 2 * (PALLET_DROP + PALLET_UNLOAD - PALLET_BUY));
});

test("cargo load leaves seats empty, mixed caps escort at 4", () => {
  assert.deepEqual(loadFor(ural, "cargo"), { pallets: 2, passengers: 0 });
  assert.deepEqual(loadFor(ural, "taxi"), { pallets: 0, passengers: 3 });
  assert.deepEqual(loadFor(ural, "mixed"), { pallets: 2, passengers: 3 });
  const lakota = getHaulVehicle("lakota");
  assert.deepEqual(loadFor(lakota, "mixed"), { pallets: 1, passengers: 4 });
  assert.equal(loadFor(lakota, "taxi").passengers, 13);
});

test("rate pick prefers a faster plan when cash is close", () => {
  const map = MAPS.bakurani;
  const { origin } = defaultHaulRoute(map);
  const ranked = optimizeHaul(HAULER_OPTIONS, map, origin.pos, origin.id, 3, {
    ownedVehicle: false,
    unloadAtFob: true,
    expectSurvive: false,
    expectKills: 0,
  });
  const rate = pickBestRate(ranked);
  assert.ok(rate);
  assert.ok(rate.session.sessionPerMin > 0);
});

test("default spawn-to-front haul is a real logistics run", () => {
  const map = MAPS.bakurani;
  const { origin, dest } = defaultHaulRoute(map);
  assert.equal(origin.fobId, "lonestar");
  assert.equal(dest.id, FRONT_FOB_ID);
  assert.ok(kmBetween(origin.pos, dest.pos) > 2.5);
});
