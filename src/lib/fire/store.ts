import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WeaponId } from "./tables.ts";
import type { Vec } from "./coords.ts";
import { MAPS, type MapId } from "./maps.ts";
import { DEFAULT_CONTROL_ZONE_DIAMETER_METERS, zoneDiameterMeters } from "./zones.ts";
import { defaultHaulRoute, FRONT_FOB_ID } from "../haul/routes.ts";
import { getHaulVehicle } from "../haul/catalog.ts";
import { fillPallets, packForVehicle, summarizeCargo } from "../haul/cargo.ts";

export type PlaceMode = "gun" | "target" | "zone";
export type InputMode = "coord" | "range";
export type ArcPreference = "auto" | "low" | "high";
export type AppPanel = "fire" | "haul";
export type DestKind = "field" | "zone" | "fob";

const BAK_HAUL = defaultHaulRoute(MAPS.bakurani);

export interface SavedMark {
  id: string;
  name: string;
  pos: Vec;
  kind: "gun" | "target";
  mapId?: MapId;
}

interface FdcState {
  weapon: WeaponId;
  mapId: MapId;
  inputMode: InputMode;
  gun: Vec | null;
  target: Vec | null;
  gunText: string;
  targetText: string;
  rangeText: string;
  dH: number;
  adjustRange: number;
  adjustAz: number;
  placeMode: PlaceMode;
  arcPreference: ArcPreference;
  zoneCenters: Partial<Record<MapId, Vec>>;
  zoneDiameters: Partial<Record<MapId, number>>;
  zonePlacementIds: Partial<Record<MapId, string>>;
  saved: SavedMark[];
  panel: AppPanel;
  vehicleId: string;
  destKind: DestKind;
  pallets: number;
  passengers: number;
  roundTrip: boolean;
  ownedVehicle: boolean;
  unloadAtFob: boolean;
  expectSurvive: boolean;
  expectKills: number;
  haulOrigin: Vec | null;
  haulDest: Vec | null;
  haulOriginId: string | null;
  haulDestId: string | null;
  haulTrips: number;
  cargoIds: string[];
  setWeapon: (w: WeaponId) => void;
  setMapId: (id: MapId) => void;
  setInputMode: (m: InputMode) => void;
  setGun: (p: Vec | null, text?: string) => void;
  setTarget: (p: Vec | null, text?: string) => void;
  setGunText: (t: string) => void;
  setTargetText: (t: string) => void;
  setRangeText: (t: string) => void;
  setDH: (n: number) => void;
  addAdjust: (rangeM: number, azDeg: number) => void;
  resetAdjust: () => void;
  setPlaceMode: (m: PlaceMode) => void;
  setArcPreference: (a: ArcPreference) => void;
  setZoneCenter: (p: Vec | null, mapId?: MapId) => void;
  setZoneDiameter: (diameterM: number, mapId?: MapId) => void;
  setZonePlacement: (placementId: string | null, mapId?: MapId) => void;
  clearZone: (mapId?: MapId) => void;
  saveCurrent: (name: string, kind: "gun" | "target") => void;
  loadMark: (id: string) => void;
  removeMark: (id: string) => void;
  swap: () => void;
  clearTarget: () => void;
  setPanel: (panel: AppPanel) => void;
  setVehicleId: (id: string) => void;
  setDestKind: (kind: DestKind) => void;
  setPallets: (n: number) => void;
  setPassengers: (n: number) => void;
  setRoundTrip: (v: boolean) => void;
  setOwnedVehicle: (v: boolean) => void;
  setUnloadAtFob: (v: boolean) => void;
  setExpectSurvive: (v: boolean) => void;
  setExpectKills: (n: number) => void;
  setHaulOrigin: (p: Vec | null, id?: string | null) => void;
  setHaulDest: (p: Vec | null, id?: string | null, kind?: DestKind) => void;
  setHaulTrips: (n: number) => void;
  setCargoIds: (ids: string[]) => void;
  resetHaulRoute: () => void;
}

export const useFdc = create<FdcState>()(
  persist(
    (set, get) => ({
      weapon: "l81",
      mapId: "bakurani",
      inputMode: "coord",
      gun: { x: 80, y: 80 },
      target: { x: 83.2, y: 82.4 },
      gunText: "80.00  80.00",
      targetText: "83.20  82.40",
      rangeText: "400",
      dH: 0,
      adjustRange: 0,
      adjustAz: 0,
      placeMode: "target",
      arcPreference: "auto",
      zoneCenters: {},
      zoneDiameters: {},
      zonePlacementIds: {},
      saved: [],
      panel: "haul",
      vehicleId: "ural",
      destKind: "fob",
      pallets: 2,
      passengers: 2,
      roundTrip: true,
      ownedVehicle: false,
      unloadAtFob: true,
      expectSurvive: true,
      expectKills: 0,
      haulOrigin: BAK_HAUL.origin.pos,
      haulDest: BAK_HAUL.dest.pos,
      haulOriginId: BAK_HAUL.origin.id,
      haulDestId: BAK_HAUL.dest.id,
      haulTrips: 3,
      cargoIds: fillPallets("ural", 2),
      setWeapon: (weapon) => set({ weapon }),
      setMapId: (mapId) => {
        const zone = get().zoneCenters[mapId] ?? null;
        const { origin, dest } = defaultHaulRoute(MAPS[mapId], zone, get().haulOriginId);
        set({
          mapId,
          haulOrigin: origin.pos,
          haulDest: dest.pos,
          haulOriginId: origin.id,
          haulDestId: dest.id,
          destKind: dest.destKind,
        });
      },
      setInputMode: (inputMode) => set({ inputMode }),
      setGun: (gun, text) =>
        set({
          gun,
          ...(text !== undefined ? { gunText: text } : { gunText: gun ? `${gun.x.toFixed(2)}  ${gun.y.toFixed(2)}` : "" }),
        }),
      setTarget: (target, text) =>
        set({
          target,
          ...(text !== undefined
            ? { targetText: text }
            : { targetText: target ? `${target.x.toFixed(2)}  ${target.y.toFixed(2)}` : "" }),
        }),
      setGunText: (gunText) => set({ gunText }),
      setTargetText: (targetText) => set({ targetText }),
      setRangeText: (rangeText) => set({ rangeText }),
      setDH: (dH) => set({ dH }),
      addAdjust: (rangeM, azDeg) =>
        set({
          adjustRange: get().adjustRange + rangeM,
          adjustAz: get().adjustAz + azDeg,
        }),
      resetAdjust: () => set({ adjustRange: 0, adjustAz: 0 }),
      setPlaceMode: (placeMode) => set({ placeMode }),
      setArcPreference: (arcPreference) => set({ arcPreference }),
      setZoneCenter: (p, mapId) => {
        const id = mapId ?? get().mapId;
        const next = { ...get().zoneCenters };
        if (p) next[id] = p;
        else delete next[id];
        const patch: Partial<FdcState> = { zoneCenters: next };
        if (p && (get().haulDestId === FRONT_FOB_ID || get().destKind === "fob")) {
          patch.haulDest = p;
          patch.haulDestId = FRONT_FOB_ID;
          patch.destKind = "fob";
        }
        set(patch);
      },
      setZoneDiameter: (diameterM, mapId) => {
        const id = mapId ?? get().mapId;
        const next = { ...get().zoneDiameters };
        next[id] = Math.max(100, Math.min(4000, Number.isFinite(diameterM) ? diameterM : DEFAULT_CONTROL_ZONE_DIAMETER_METERS));
        set({ zoneDiameters: next });
      },
      setZonePlacement: (placementId, mapId) => {
        const id = mapId ?? get().mapId;
        const ids = { ...get().zonePlacementIds };
        const diameters = { ...get().zoneDiameters };
        if (placementId) {
          ids[id] = placementId;
          diameters[id] = zoneDiameterMeters(id, placementId);
        } else {
          delete ids[id];
        }
        set({ zonePlacementIds: ids, zoneDiameters: diameters });
      },
      clearZone: (mapId) => {
        const id = mapId ?? get().mapId;
        const next = { ...get().zoneCenters };
        delete next[id];
        set({ zoneCenters: next });
      },
      saveCurrent: (name, kind) => {
        const pos = kind === "gun" ? get().gun : get().target;
        if (!pos) return;
        const mark: SavedMark = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          pos,
          kind,
          mapId: get().mapId,
        };
        set({ saved: [mark, ...get().saved].slice(0, 24) });
      },
      loadMark: (id) => {
        const mark = get().saved.find((s) => s.id === id);
        if (!mark) return;
        if (mark.mapId) set({ mapId: mark.mapId });
        if (mark.kind === "gun") get().setGun(mark.pos);
        else get().setTarget(mark.pos);
      },
      removeMark: (id) => set({ saved: get().saved.filter((s) => s.id !== id) }),
      swap: () => {
        const { gun, target, gunText, targetText } = get();
        set({
          gun: target,
          target: gun,
          gunText: targetText,
          targetText: gunText,
        });
      },
      clearTarget: () => set({ target: null, targetText: "", adjustRange: 0, adjustAz: 0 }),
      setPanel: (panel) => {
        if (panel === "haul") {
          const { haulOrigin, haulDest, mapId } = get();
          if (!haulOrigin || !haulDest) {
            const { origin, dest } = defaultHaulRoute(MAPS[mapId], get().zoneCenters[mapId], get().haulOriginId);
            set({
              panel,
              placeMode: "target",
              haulOrigin: origin.pos,
              haulDest: dest.pos,
              haulOriginId: origin.id,
              haulDestId: dest.id,
              destKind: dest.destKind,
            });
            return;
          }
          set({ panel, placeMode: "target" });
          return;
        }
        set({ panel });
      },
      setVehicleId: (vehicleId) => {
        const vehicle = getHaulVehicle(vehicleId);
        const packed = packForVehicle(vehicleId, get().cargoIds);
        const pallets = summarizeCargo(packed.placed).pallets;
        const passengers = Math.max(0, Math.min(get().passengers, vehicle.passengers));
        set({ vehicleId, pallets, passengers, cargoIds: packed.placed });
      },
      setDestKind: (destKind) => set({ destKind }),
      setPallets: (pallets) => {
        const vehicle = getHaulVehicle(get().vehicleId);
        const n = Math.max(0, Math.min(vehicle.palletSlots, Math.round(pallets)));
        const current = get().cargoIds;
        const palletType = current.map((id) => id).find((id) => id.startsWith("pallet-")) ?? "pallet-ammo";
        const kit = current.filter((id) => !id.startsWith("pallet-") && !id.startsWith("crate-"));
        const next = packForVehicle(vehicle.id, [...fillPallets(vehicle.id, n, palletType), ...kit]).placed;
        set({ pallets: n, cargoIds: next });
      },
      setPassengers: (passengers) => set({ passengers: Math.max(0, Math.min(16, Math.round(passengers))) }),
      setRoundTrip: (roundTrip) => set({ roundTrip }),
      setOwnedVehicle: (ownedVehicle) => set({ ownedVehicle }),
      setUnloadAtFob: (unloadAtFob) => set({ unloadAtFob }),
      setExpectSurvive: (expectSurvive) => set({ expectSurvive }),
      setExpectKills: (expectKills) => set({ expectKills: Math.max(0, Math.min(20, Math.round(expectKills))) }),
      setHaulOrigin: (p, id) => set({ haulOrigin: p, haulOriginId: id ?? "custom" }),
      setHaulDest: (p, id, kind) =>
        set({
          haulDest: p,
          haulDestId: id ?? "custom",
          ...(kind ? { destKind: kind } : {}),
        }),
      setHaulTrips: (haulTrips) => set({ haulTrips: Math.max(1, Math.min(12, Math.round(haulTrips))) }),
      setCargoIds: (ids) => {
        const packed = packForVehicle(get().vehicleId, ids);
        set({ cargoIds: packed.placed, pallets: summarizeCargo(packed.placed).pallets });
      },
      resetHaulRoute: () => {
        const { mapId, haulOriginId, zoneCenters } = get();
        const { origin, dest } = defaultHaulRoute(MAPS[mapId], zoneCenters[mapId], haulOriginId);
        set({
          haulOrigin: origin.pos,
          haulDest: dest.pos,
          haulOriginId: origin.id,
          haulDestId: dest.id,
          destKind: dest.destKind,
          placeMode: "target",
        });
      },
    }),
    {
      name: "wardogs-fdc",
      skipHydration: true,
      version: 5,
      migrate: (persisted) => {
        const prev: Record<string, unknown> = { ...(persisted as Record<string, unknown>), panel: "haul" };
        if (!Array.isArray(prev.cargoIds)) {
          const vehicleId = typeof prev.vehicleId === "string" ? prev.vehicleId : "ural";
          const n = typeof prev.pallets === "number" ? prev.pallets : 2;
          prev.cargoIds = fillPallets(vehicleId, n);
        }
        if (typeof prev.haulDestId === "string" && prev.haulDestId.startsWith("fob-")) {
          prev.haulDestId = FRONT_FOB_ID;
          prev.destKind = "fob";
        }
        return prev;
      },
      partialize: (s) => ({
        weapon: s.weapon,
        mapId: s.mapId,
        gun: s.gun,
        gunText: s.gunText,
        saved: s.saved,
        dH: s.dH,
        arcPreference: s.arcPreference,
        zoneCenters: s.zoneCenters,
        zoneDiameters: s.zoneDiameters,
        zonePlacementIds: s.zonePlacementIds,
        panel: s.panel,
        vehicleId: s.vehicleId,
        destKind: s.destKind,
        pallets: s.pallets,
        passengers: s.passengers,
        roundTrip: s.roundTrip,
        ownedVehicle: s.ownedVehicle,
        unloadAtFob: s.unloadAtFob,
        expectSurvive: s.expectSurvive,
        expectKills: s.expectKills,
        haulOrigin: s.haulOrigin,
        haulDest: s.haulDest,
        haulOriginId: s.haulOriginId,
        haulDestId: s.haulDestId,
        haulTrips: s.haulTrips,
        cargoIds: s.cargoIds,
      }),
    },
  ),
);
