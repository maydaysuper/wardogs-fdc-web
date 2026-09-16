import assert from "node:assert/strict";
import test from "node:test";
import { fillPallets, packForVehicle, summarizeCargo } from "./cargo.ts";
import { FACTION_ORDER, FACTIONS } from "./factions.ts";
import { AIR_FILTERS, LAND_FILTERS, VENDOR_ROWS, matchesVendor, vendorTabOf } from "./catalog.ts";
import { getFobStops } from "./routes.ts";
import { MAPS } from "../fire/maps.ts";

test("Ural 8×2 takes two pallets and rejects a third", () => {
  const two = packForVehicle("ural", ["pallet-ammo", "pallet-build"]);
  assert.equal(two.leftover.length, 0);
  assert.equal(summarizeCargo(two.placed).pallets, 2);
  assert.equal(two.placements.length, 2);
  const three = packForVehicle("ural", ["pallet-ammo", "pallet-ammo", "pallet-ammo"]);
  assert.equal(summarizeCargo(three.placed).pallets, 2);
  assert.equal(three.leftover.length, 1);
});

test("Lakota 4×2 takes one pallet, Humvee 4×1 takes crates not pallets", () => {
  assert.equal(fillPallets("lakota", 2).length, 1);
  const humvee = packForVehicle("humvee", ["pallet-ammo", "crate-large"]);
  assert.equal(summarizeCargo(humvee.placed).pallets, 0);
  assert.equal(summarizeCargo(humvee.placed).crates, 1);
});

test("MH-6 has two crate slots and cannot lift a pallet", () => {
  const packed = packForVehicle("mh6", ["pallet-ammo", "crate-small", "crate-large", "crate-small"]);
  assert.equal(summarizeCargo(packed.placed).pallets, 0);
  assert.equal(summarizeCargo(packed.placed).crates, 2);
});

test("FOB chips are 红方 蓝方 绿方 in that order", () => {
  assert.deepEqual(
    FACTION_ORDER.map((id) => FACTIONS[id].nameZh),
    ["红方", "蓝方", "绿方"],
  );
  const shorts = getFobStops(MAPS.bakurani).map((stop) => stop.short);
  assert.deepEqual(shorts, ["红方", "蓝方", "绿方"]);
});

test("vehicle vendor LAND/AIR filters match in-game tabs", () => {
  assert.equal(vendorTabOf("ural"), "land");
  assert.equal(vendorTabOf("lakota"), "air");
  assert.equal(vendorTabOf("l2a6"), "land");
  const landAll = VENDOR_ROWS.filter((row) => matchesVendor(row, "land", "all"));
  const tanks = VENDOR_ROWS.filter((row) => matchesVendor(row, "land", "tank"));
  const arty = VENDOR_ROWS.filter((row) => matchesVendor(row, "land", "artillery"));
  const airCombat = VENDOR_ROWS.filter((row) => matchesVendor(row, "air", "combat"));
  assert.equal(landAll.some((row) => row.id === "mh6"), false);
  assert.deepEqual(tanks.map((row) => row.id).sort(), ["gepard", "l2a6"]);
  assert.deepEqual(arty.map((row) => row.id), ["sph-2"]);
  assert.equal(airCombat.some((row) => row.id === "havoc"), true);
  assert.equal(airCombat.some((row) => row.id === "mh6"), false);
  assert.ok(LAND_FILTERS.some((f) => f.en === "TRANSPORT"));
  assert.ok(AIR_FILTERS.some((f) => f.en === "COMBAT"));
});
