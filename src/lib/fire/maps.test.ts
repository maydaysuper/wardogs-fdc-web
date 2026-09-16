import assert from "node:assert/strict";
import test from "node:test";
import { MAP_SIZE_UNITS } from "./coords.ts";
import { MAPS, fitTowersView, getTowerMarkers, visHeight } from "./maps.ts";

/** Metres from community map JSON, divided by 100. */
const expected = {
  bakurani: [
    ["塔 1", 80.52, 69.85],
    ["塔 2", 77.19, 70.0],
    ["塔 3", 77.19, 73.44],
    ["塔 4", 83.64, 72.85],
    ["塔 5", 82.22, 68.41],
  ],
  ozeti: [
    ["塔 1", 95.8, 62.82],
    ["塔 2", 100.37, 59.23],
    ["塔 3", 104.49, 63.71],
    ["塔 4", 100.62, 67.64],
  ],
  zestafona: [
    ["塔 1", 68.6, 104.15],
    ["塔 2", 72.89, 105.07],
    ["塔 3", 70.17, 100.17],
  ],
} as const;

for (const [mapId, towers] of Object.entries(expected) as [keyof typeof expected, (typeof expected)[keyof typeof expected]][]) {
  test(`${mapId} tower anchors match compound centres`, () => {
    const actual = getTowerMarkers(MAPS[mapId]);
    assert.equal(actual.length, towers.length);
    for (const [label, x, y] of towers) {
      const marker = actual.find((entry) => entry.label === label);
      assert.ok(marker, `missing ${label}`);
      assert.ok(Math.abs(marker.pos.x - x) < 1e-9, `${label} x mismatch`);
      assert.ok(Math.abs(marker.pos.y - y) < 1e-9, `${label} y mismatch`);
      assert.ok(marker.pos.x >= 0 && marker.pos.x <= 163.84);
      assert.ok(marker.pos.y >= 0 && marker.pos.y <= 163.84);
    }
  });
}

test("bakurani has five capturable towers, not inactive map-file names", () => {
  const labels = getTowerMarkers(MAPS.bakurani).map((m) => m.label);
  assert.deepEqual(labels, ["塔 1", "塔 2", "塔 3", "塔 4", "塔 5"]);
});

test("zestafona keeps three capturable towers", () => {
  assert.equal(getTowerMarkers(MAPS.zestafona).length, 3);
});

test("fitTowersView keeps every tower on screen", () => {
  const vp = { w: 1280, h: 800 };
  for (const map of Object.values(MAPS)) {
    const cam = fitTowersView(map, MAP_SIZE_UNITS, vp);
    const visH = visHeight(cam.s, vp);
    for (const tower of getTowerMarkers(map)) {
      assert.ok(tower.pos.x >= cam.x && tower.pos.x <= cam.x + cam.s, `${map.id} ${tower.label} x`);
      const svgY = MAP_SIZE_UNITS - tower.pos.y;
      assert.ok(svgY >= cam.y && svgY <= cam.y + visH, `${map.id} ${tower.label} y`);
    }
  }
});
