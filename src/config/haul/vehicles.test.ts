import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const vehicles = JSON.parse(readFileSync(new URL("./vehicles.json", import.meta.url), "utf8")) as {
  id: string;
  nameZh: string;
  group: string;
  price: number;
  unlockPrice: number;
  passengers: number;
  pallets: boolean;
}[];

const byId = Object.fromEntries(vehicles.map((v) => [v.id, v]));

test("season 1 spawn prices match the garage vendor", () => {
  assert.equal(byId.bobcat.price, 500);
  assert.equal(byId["dune-buggy"].price, 1500);
  assert.equal(byId.kodiak.price, 2500);
  assert.equal(byId["kodiak-pickup"].price, 3000);
  assert.equal(byId.humvee.price, 3000);
  assert.equal(byId["kodiak-m249"].price, 3750);
  assert.equal(byId["humvee-m249"].price, 3750);
  assert.equal(byId["humvee-minigun"].price, 4500);
  assert.equal(byId.ural.price, 5000);
  assert.equal(byId["ural-defender"].price, 6000);
  assert.equal(byId["ural-defender-m249"].price, 6750);
  assert.equal(byId.mh6.price, 6250);
  assert.equal(byId.ah6m.price, 7000);
  assert.equal(byId.lakota.price, 7400);
  assert.equal(byId["lakota-miniguns"].price, 8000);
  assert.equal(byId.ah6r.price, 12500);
  assert.equal(byId.havoc.price, 18000);
  assert.equal(byId["sph-2"].price, 8000);
  assert.equal(byId.gepard.price, 10000);
  assert.equal(byId.l2a6.price, 14000);
});

test("unlock fees are one-shot, not spawn prices", () => {
  assert.equal(byId.bobcat.unlockPrice, 0);
  assert.equal(byId["dune-buggy"].unlockPrice, 25000);
  assert.equal(byId["kodiak-pickup"].unlockPrice, 35000);
  assert.equal(byId.ural.unlockPrice, 35000);
  assert.equal(byId.lakota.unlockPrice, 35000);
  assert.equal(byId.l2a6.unlockPrice, 500000);
});

test("seats are seated passengers, Ural is 3 not 8", () => {
  assert.equal(byId.ural.passengers, 3);
  assert.equal(byId.ural.pallets, true);
  assert.equal(byId["kodiak-pickup"].passengers, 6);
  assert.equal(byId.kodiak.passengers, 4);
  assert.equal(byId.mh6.passengers, 6);
  assert.equal(byId.lakota.passengers, 13);
});

test("vendor lists all 20 garage rows", () => {
  assert.equal(vehicles.length, 20);
  assert.equal(new Set(vehicles.map((v) => v.id)).size, 20);
});
