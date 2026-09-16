import assert from "node:assert/strict";
import test from "node:test";
import { MAPS } from "../fire/maps.ts";
import {
  FRONT_FOB_ID,
  kmBetween,
  defaultHaulRoute,
  getFobStops,
  getHaulDestinations,
  getTowerStops,
  rankRoutes,
} from "./routes.ts";
import type { HaulVehicle } from "./economy.ts";

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

for (const map of Object.values(MAPS)) {
  test(`${map.id} default haul is spawn HQ → 前线 FOB, not another faction base`, () => {
    const { origin, dest } = defaultHaulRoute(map);
    assert.ok(origin.fobId);
    assert.equal(dest.id, FRONT_FOB_ID);
    assert.equal(dest.destKind, "fob");
    assert.notEqual(origin.id, dest.id);
    const km = kmBetween(origin.pos, dest.pos);
    assert.ok(km > 2.5, `${map.id} default too short: ${km}`);
    assert.ok(km < 16, `${map.id} default too long: ${km}`);
    const dests = getHaulDestinations(map, origin.id);
    assert.equal(dests.some((stop) => stop.id.startsWith("fob-")), false);
    assert.ok(dests.some((stop) => stop.id === FRONT_FOB_ID));
  });

  test(`${map.id} has three spawn HQs and the capturable towers`, () => {
    assert.equal(getFobStops(map).length, 3);
    assert.ok(getTowerStops(map).length >= 3);
  });
}

test("map route rank puts 前线 FOB ahead of a tower when unload pays", () => {
  const map = MAPS.bakurani;
  const { origin } = defaultHaulRoute(map);
  const ranked = rankRoutes(
    map,
    origin.pos,
    origin.id,
    ural,
    {
      pallets: 2,
      passengers: 2,
      roundTrip: true,
      ownedVehicle: false,
      unloadAtFob: true,
      expectSurvive: true,
      expectKills: 0,
    },
    3,
  );
  assert.ok(ranked.length >= 4);
  assert.equal(ranked[0].stop.id, FRONT_FOB_ID);
  assert.equal(ranked[0].stop.destKind, "fob");
  assert.ok(ranked[0].session.sessionNet > 0);
  const tower = ranked.find((row) => row.stop.destKind === "zone");
  assert.ok(tower);
  assert.ok(ranked[0].session.sessionNet >= tower.session.sessionNet);
});
