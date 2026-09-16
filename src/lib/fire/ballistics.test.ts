import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatSolutionChat, solveWeapon } from "./ballistics.ts";
import { azimuthDeg, distanceMeters, parsePair, siteAngleMils } from "./coords.ts";

describe("L81 firing table", () => {
  it("returns 583 mil at 400 m", () => {
    const sol = solveWeapon("l81", 400, 0, null);
    assert.equal(sol.arcs[0]?.mils, 583);
    assert.equal(sol.status, "ok");
  });

  it("returns 150 mil near max range 684 m", () => {
    const sol = solveWeapon("l81", 684, 0, null);
    assert.equal(sol.arcs[0]?.mils, 150);
  });

  it("normalizes adjusted azimuth into 0-360 and 0-6400 mils", () => {
    const sol = solveWeapon("l81", 400, 0, -1);
    assert.equal(sol.azimuthDeg, 359);
    assert.ok(sol.dirMils != null && sol.dirMils > 6380 && sol.dirMils < 6400);
  });

  it("flags too close under 80 m", () => {
    const sol = solveWeapon("l81", 40, 0, null);
    assert.equal(sol.status, "too-close");
    assert.equal(sol.arcs.length, 0);
  });

  it("flags out of range over 700 m", () => {
    const sol = solveWeapon("l81", 900, 0, null);
    assert.equal(sol.status, "out-of-range");
  });
});

describe("SPH-2 firing table", () => {
  it("low arc near 80 mil at 1482 m", () => {
    const sol = solveWeapon("sph2", 1482, 0, null);
    const low = sol.arcs.find((a) => a.arc === "low");
    assert.equal(low?.mils, 80);
  });

  it("offers both arcs at 2000 m", () => {
    const sol = solveWeapon("sph2", 2000, 0, null);
    assert.equal(sol.arcs.length, 2);
    const low = sol.arcs.find((a) => a.arc === "low");
    const high = sol.arcs.find((a) => a.arc === "high");
    assert.ok(low && low.mils > 200 && low.mils < 230);
    assert.ok(high && high.mils > 1040 && high.mils < 1070);
  });

  it("copies only the selected SPH-2 arc when requested", () => {
    const sol = solveWeapon("sph2", 2000, 0, 90);
    const text = formatSolutionChat(sol, "high");
    assert.match(text, /高弹 射角/);
    assert.doesNotMatch(text, /低弹 射角/);
  });
});

describe("coordinates", () => {
  it("parses game X Y pairs", () => {
    assert.deepEqual(parsePair("81.89 81.91"), { x: 81.89, y: 81.91 });
    assert.deepEqual(parsePair("X81.89 Y81.91"), { x: 81.89, y: 81.91 });
  });

  it("parses grid I9-45", () => {
    const p = parsePair("I9-45");
    assert.ok(p);
    assert.equal(Math.floor(p.x / 10), 8);
    assert.equal(Math.floor(p.y / 10), 8);
  });

  it("computes 400 m east as 90°", () => {
    const a = { x: 80, y: 80 };
    const b = { x: 84, y: 80 };
    assert.equal(Math.round(distanceMeters(a, b)), 400);
    assert.equal(Math.round(azimuthDeg(a, b)), 90);
  });

  it("computes north as 0°", () => {
    assert.equal(Math.round(azimuthDeg({ x: 10, y: 10 }, { x: 10, y: 12 })), 0);
  });

  it("site angle is 67 mil at +100 m / 1500 m", () => {
    assert.equal(Math.round(siteAngleMils(1500, 100)), 67);
  });
});
