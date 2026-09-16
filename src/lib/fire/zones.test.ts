import assert from "node:assert/strict";
import test from "node:test";
import { MAPS } from "./maps.ts";
import {
  CONTROL_ZONE_CATALOG,
  DEFAULT_CONTROL_ZONE_DIAMETER_METERS,
  controlZoneBounds,
  distanceToControlZoneMeters,
  getNearestTowerToControlZone,
  getTowersInControlZone,
  isPointInControlZone,
  zoneDiameterMeters,
} from "./zones.ts";

test("default control zone is a 1 km diameter circle", () => {
  assert.equal(DEFAULT_CONTROL_ZONE_DIAMETER_METERS, 1000);
  const b = controlZoneBounds({ x: 80, y: 70 });
  assert.deepEqual(b, { minX: 75, maxX: 85, minY: 65, maxY: 75 });
});

test("circle containment includes radial boundary but excludes square corners", () => {
  const c = { x: 80, y: 70 };
  assert.equal(isPointInControlZone({ x: 85, y: 70 }, c), true);
  assert.equal(isPointInControlZone({ x: 80, y: 75 }, c), true);
  assert.equal(isPointInControlZone({ x: 85, y: 75 }, c), false);
});

test("distance to circular boundary is metric", () => {
  const c = { x: 80, y: 70 };
  assert.equal(distanceToControlZoneMeters({ x: 80, y: 70 }, c), 0);
  assert.equal(distanceToControlZoneMeters({ x: 86, y: 70 }, c), 100);
});

test("map placement catalog matches current rotation model", () => {
  assert.deepEqual(CONTROL_ZONE_CATALOG.bakurani.map((z) => z.label), ["Default", "Farmland", "Lumberyard"]);
  assert.equal(CONTROL_ZONE_CATALOG.ozeti.length, 5);
  assert.equal(zoneDiameterMeters("ozeti", "paris-default"), 1100);
  assert.equal(CONTROL_ZONE_CATALOG.zestafona.find((z) => z.id === "detroit-small-factory")?.status, "never-rolled");
  assert.equal(CONTROL_ZONE_CATALOG.zestafona.filter((z) => z.status === "active").length, 3);
});

test("tower membership uses circle geometry", () => {
  const center = MAPS.bakurani.markers.find((m) => m.label === "塔 1")!.pos;
  const towers = getTowersInControlZone(MAPS.bakurani, center, 1000);
  assert.ok(towers.some((tower) => tower.label === "塔 1"));
  for (const tower of towers) assert.ok(isPointInControlZone(tower.pos, center, 1000));
});

for (const id of ["bakurani", "ozeti", "zestafona"] as const) {
  test(`${id} nearest tower relation is stable`, () => {
    const firstTower = MAPS[id].markers.find((m) => m.kind === "tower");
    assert.ok(firstTower);
    const nearest = getNearestTowerToControlZone(MAPS[id], firstTower.pos, 1000);
    assert.ok(nearest);
    assert.equal(nearest.distanceToZoneM, 0);
  });
}
