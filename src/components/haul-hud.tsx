import { useMemo, useState } from "react";
import { ChevronUp, Copy, Minus, Plus, SquareDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VehicleGlyph } from "@/components/vehicle-glyph";
import { CargoGlyph } from "@/components/cargo-glyph";
import { GameIcon } from "@/components/game-icon";
import { VehiclePicker } from "@/components/vehicle-picker";
import { CargoPicker } from "@/components/cargo-picker";
import { HAULER_OPTIONS, NAME_EN, getBed, getHaulVehicle } from "@/lib/haul/catalog";
import { cargoLabel, getCargo, summarizeCargo } from "@/lib/haul/cargo";
import { FACTIONS, type FobId } from "@/lib/haul/factions";
import {
  compareDestinations,
  recommendForLoad,
  scoreSession,
  scoreTrip,
  type DestKind,
  type TripBreakdown,
} from "@/lib/haul/economy";
import { FRONT_FOB_ID, getFobStops, getFrontStop, getTowerStops, rankRoutes, type HaulStop } from "@/lib/haul/routes";
import { loadFor, modeLabel, optimizeHaul, pickBestHaul, pickBestRate, planKey, planMatches, uniquePlans } from "@/lib/haul/optimize";
import { MAPS, type MapId } from "@/lib/fire/maps";
import type { Vec } from "@/lib/fire/coords";
import { cn } from "@/lib/utils";

function money(n: number) {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "−" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

function destLabel(kind: DestKind) {
  if (kind === "fob") return "前线FOB";
  if (kind === "zone") return "战区";
  return "野外";
}

function Stepper({
  label,
  value,
  onChange,
  max,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max: number;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-hud-2 p-1">
      <span className="px-1.5 text-xs text-muted">{label}</span>
      <button
        type="button"
        className="inline-flex size-9 items-center justify-center rounded-md hover:bg-fg/10 disabled:opacity-40"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`减少${label}`}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-6 text-center font-mono text-sm tabular-nums">{value}</span>
      <button
        type="button"
        className="inline-flex size-9 items-center justify-center rounded-md hover:bg-fg/10 disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`增加${label}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("h-9 rounded-md px-2.5 text-xs font-medium", on ? "bg-accent text-accent-fg" : "bg-hud-2 text-fg hover:bg-fg/10")}
    >
      {children}
    </button>
  );
}

function FactionChip({ id, on, onClick }: { id: FobId; on: boolean; onClick: () => void }) {
  const faction = FACTIONS[id];
  return (
    <button
      type="button"
      title={`${faction.nameZh} ${faction.nameEn}`}
      onClick={onClick}
      className={cn("inline-flex h-11 min-w-16 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold", on ? faction.chipOn : faction.chipOff)}
    >
      <GameIcon name={id} className="size-5" />
      {faction.nameZh}
    </button>
  );
}

export function HaulHud({
  mapId,
  origin,
  dest,
  originId,
  destId,
  vehicleId,
  destKind,
  pallets,
  passengers,
  roundTrip,
  ownedVehicle,
  unloadAtFob,
  expectSurvive,
  expectKills,
  trips,
  distanceKm,
  cargoIds,
  zoneCenter,
  placeMode,
  onPlaceMode,
  onVehicleId,
  onDestKind,
  onPallets,
  onPassengers,
  onRoundTrip,
  onOwnedVehicle,
  onUnloadAtFob,
  onExpectSurvive,
  onExpectKills,
  onTrips,
  onCargoIds,
  onPickOrigin,
  onPickDest,
  onResetRoute,
  onCopy,
}: {
  mapId: MapId;
  origin: Vec | null;
  dest: Vec | null;
  originId: string | null;
  destId: string | null;
  vehicleId: string;
  destKind: DestKind;
  pallets: number;
  passengers: number;
  roundTrip: boolean;
  ownedVehicle: boolean;
  unloadAtFob: boolean;
  expectSurvive: boolean;
  expectKills: number;
  trips: number;
  distanceKm: number;
  cargoIds: string[];
  zoneCenter: Vec | null;
  placeMode: "gun" | "target" | "zone";
  onPlaceMode: (mode: "gun" | "target" | "zone") => void;
  onVehicleId: (id: string) => void;
  onDestKind: (kind: DestKind) => void;
  onPallets: (n: number) => void;
  onPassengers: (n: number) => void;
  onRoundTrip: (v: boolean) => void;
  onOwnedVehicle: (v: boolean) => void;
  onUnloadAtFob: (v: boolean) => void;
  onExpectSurvive: (v: boolean) => void;
  onExpectKills: (n: number) => void;
  onTrips: (n: number) => void;
  onCargoIds: (ids: string[]) => void;
  onPickOrigin: (stop: HaulStop) => void;
  onPickDest: (stop: HaulStop) => void;
  onResetRoute: () => void;
  onCopy: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<null | "vehicle" | "cargo">(null);
  const map = MAPS[mapId];
  const fobs = getFobStops(map);
  const towers = getTowerStops(map);
  const front = getFrontStop(map, zoneCenter);
  const vehicle = getHaulVehicle(vehicleId);
  const bed = getBed(vehicleId);
  const cargo = useMemo(() => summarizeCargo(cargoIds), [cargoIds]);
  const bedItems = useMemo(
    () => cargoIds.map(getCargo).filter((item) => item?.slot === "bed"),
    [cargoIds],
  );
  const input = useMemo(
    () => ({
      destKind,
      distanceKm,
      pallets,
      passengers,
      roundTrip,
      ownedVehicle,
      unloadAtFob,
      extraCost: cargo.extraCost,
      expectSurvive,
      expectKills,
    }),
    [destKind, distanceKm, pallets, passengers, roundTrip, ownedVehicle, unloadAtFob, cargo.extraCost, expectSurvive, expectKills],
  );
  const trip = useMemo(() => scoreTrip(vehicle, input), [vehicle, input]);
  const session = useMemo(() => scoreSession(vehicle, input, trips), [vehicle, input, trips]);
  const dests = useMemo(() => compareDestinations(vehicle, input), [vehicle, input]);
  const rankedLoad = useMemo(() => recommendForLoad(HAULER_OPTIONS, input, trips), [input, trips]);
  const bestLoad = rankedLoad[0];
  const ready = Boolean(origin && dest && distanceKm > 0.05);
  const bestLoadName = HAULER_OPTIONS.find((v) => v.id === bestLoad?.first.vehicleId)?.nameZh;
  const mapRoutes = useMemo(
    () =>
      origin
        ? rankRoutes(
            map,
            origin,
            originId,
            vehicle,
            {
              pallets,
              passengers,
              roundTrip,
              ownedVehicle,
              unloadAtFob,
              extraCost: cargo.extraCost,
              expectSurvive,
              expectKills,
            },
            trips,
            zoneCenter,
          ).slice(0, 6)
        : [],
    [origin, map, originId, vehicle, pallets, passengers, roundTrip, ownedVehicle, unloadAtFob, cargo.extraCost, expectSurvive, expectKills, trips, zoneCenter],
  );
  const bestRoute = mapRoutes[0];
  const plans = useMemo(
    () =>
      origin
        ? optimizeHaul(HAULER_OPTIONS, map, origin, originId, trips, {
            ownedVehicle,
            ownedVehicleId: vehicle.id,
            unloadAtFob,
            expectSurvive,
            expectKills,
            zoneCenter,
          })
        : [],
    [origin, map, originId, trips, ownedVehicle, vehicle.id, unloadAtFob, expectSurvive, expectKills, zoneCenter],
  );
  const bestPlan = pickBestHaul(plans);
  const bestRate = pickBestRate(plans);
  const haulPool = plans.filter((plan) => plan.trip.palletsLoaded > 0);
  const rateIsDifferent = Boolean(bestPlan && bestRate && planKey(bestPlan) !== planKey(bestRate));
  const alreadyBest = Boolean(bestPlan && planMatches(bestPlan, vehicle.id, destId, roundTrip, pallets, passengers));
  const applyPlan = (plan: NonNullable<typeof bestPlan>) => {
    const load = loadFor(plan.vehicle, plan.mode);
    onVehicleId(plan.vehicle.id);
    onPallets(load.pallets);
    onPassengers(load.passengers);
    onRoundTrip(plan.roundTrip);
    onPickDest(plan.stop);
  };
  const showLoadSwap = Boolean(
    ready && bestLoad && bestLoad.first.vehicleId !== vehicle.id && bestLoad.sessionNet > session.sessionNet && bestLoad.sessionNet > 0,
  );
  const showDestKindSwap = Boolean(
    ready && destKind !== "fob" && dests[0]?.destKind === "fob" && dests[0].net > trip.net && dests[0].net > 0,
  );
  const showRouteSwap = Boolean(
    ready && bestRoute && bestRoute.stop.id !== destId && bestRoute.session.sessionNet > session.sessionNet && bestRoute.session.sessionNet > 0,
  );

  const originStop = fobs.find((stop) => stop.id === originId);
  const originName = originStop?.short ?? "我方";
  const originFaction = originStop?.fobId ? FACTIONS[originStop.fobId] : null;
  const destStop = destId === FRONT_FOB_ID ? front : towers.find((stop) => stop.id === destId);
  const destName = destStop?.short ?? destLabel(destKind);
  const chat = [
    `账本 ${vehicle.nameZh} ${distanceKm.toFixed(1)} km${roundTrip ? " 往返" : ""} ${destLabel(destKind)}`,
    `${originName}车库 → ${destName}`,
    `${trip.palletsLoaded}托盘 ${trip.passengersLoaded}人 本趟 ${money(trip.net)} · ${trips}趟 ${money(session.sessionNet)}`,
    bestPlan ? `运输最优 ${bestPlan.vehicle.nameZh} ${originName}车库→${bestPlan.stop.short} ${modeLabel(bestPlan.mode)} ${money(bestPlan.session.sessionNet)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const cycleOrigin = () => {
    const live = fobs.filter((stop) => stop.fobId);
    if (!live.length) return;
    const idx = Math.max(0, live.findIndex((stop) => stop.id === originId));
    onPickOrigin(live[(idx + 1) % live.length]);
  };

  return (
    <div className={cn("flex flex-col gap-2", open && "fdc-sheet-open")}>
      {sheet === "vehicle" ? <VehiclePicker selectedId={vehicleId} onSelect={onVehicleId} onClose={() => setSheet(null)} /> : null}
      {sheet === "cargo" ? <CargoPicker vehicleId={vehicleId} cargoIds={cargoIds} onChange={onCargoIds} onClose={() => setSheet(null)} /> : null}

      {open ? (
        <div className="hidden gap-2 desk:grid md:grid-cols-3">
          <div className="rounded-xl hud-glass p-3 shadow-border">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">地图航线 · 当前车货</p>
            <ul className="flex flex-col gap-1">
              {mapRoutes.map((row) => (
                <li key={row.stop.id}>
                  <button
                    type="button"
                    onClick={() => onPickDest(row.stop)}
                    className={cn(
                      "flex w-full items-baseline justify-between rounded-md px-2 py-1.5 text-left hover:bg-fg/10",
                      row.stop.id === destId ? "bg-hud-2" : "",
                    )}
                  >
                    <span className="text-sm">
                      {row.stop.short}
                      <span className="ml-1 text-xs text-muted">
                        {row.distanceKm.toFixed(1)} km · {destLabel(row.stop.destKind)}
                      </span>
                    </span>
                    <span className={cn("font-mono text-sm tabular-nums", row.session.sessionNet >= 0 ? "text-ok" : "text-danger")}>
                      {money(row.session.sessionNet)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-snug text-subtle">按真实距离连跑 {trips} 趟。FOB 卸进库通常压过送塔。</p>
          </div>
          <div className="rounded-xl hud-glass p-3 shadow-border">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">卸货方式 · 同路同距</p>
            <ul className="flex flex-col gap-1">
              {dests.map((row) => (
                <li key={row.destKind}>
                  <button
                    type="button"
                    onClick={() => onDestKind(row.destKind)}
                    className={cn("flex w-full items-baseline justify-between rounded-md px-2 py-1.5 text-left hover:bg-fg/10", row.destKind === destKind ? "bg-hud-2" : "")}
                  >
                    <span className="text-sm">
                      {destLabel(row.destKind)}
                      {row.destKind === dests[0].destKind ? <span className="ml-2 text-xs text-ok">最优</span> : null}
                    </span>
                    <span className={cn("font-mono text-sm tabular-nums", row.net >= 0 ? "text-ok" : "text-danger")}>{money(row.net)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1">
              <Toggle on={unloadAtFob} onClick={() => onUnloadAtFob(!unloadAtFob)}>
                FOB卸进库
              </Toggle>
              <Toggle on={expectSurvive} onClick={() => onExpectSurvive(!expectSurvive)}>
                乘客存活
              </Toggle>
              <Stepper label="击杀奖" value={expectKills} onChange={onExpectKills} max={12} />
            </div>
            <p className="mt-2 text-xs leading-snug text-subtle">野外倒货 $0。战区投放 $2,500。FOB 再卸进库 +$1,800。托盘买价 $400。</p>
          </div>
          <div className="rounded-xl hud-glass p-3 shadow-border">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">联合搜索 · 车×路×编制</p>
            <ul className="flex flex-col gap-1">
              {uniquePlans(haulPool, 5).map((plan, i) => (
                <li key={planKey(plan)}>
                  <button
                    type="button"
                    onClick={() => applyPlan(plan)}
                    className={cn("flex w-full items-baseline justify-between rounded-md px-2 py-1.5 text-left hover:bg-fg/10", planKey(plan) === (bestPlan ? planKey(bestPlan) : "") ? "bg-hud-2" : "")}
                  >
                    <span className="min-w-0 truncate text-sm">
                      {i + 1}. {plan.vehicle.nameZh} · {plan.stop.short} · {modeLabel(plan.mode)}
                      <span className="ml-1 text-xs text-muted">{plan.roundTrip ? "往返" : "单程"}</span>
                    </span>
                    <span className={cn("shrink-0 font-mono text-sm tabular-nums", plan.session.sessionNet >= 0 ? "text-ok" : "text-danger")}>{money(plan.session.sessionNet)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {rateIsDifferent && bestRate ? (
              <button type="button" onClick={() => applyPlan(bestRate)} className="mt-2 flex w-full items-baseline justify-between rounded-md px-2 py-1.5 text-left hover:bg-fg/10">
                <span className="text-sm">
                  最快每分 {bestRate.vehicle.nameZh} · {bestRate.stop.short}
                  <span className="ml-1 text-xs text-muted">{modeLabel(bestRate.mode)}</span>
                </span>
                <span className="font-mono text-sm tabular-nums text-ok">{bestRate.session.sessionPerMin.toFixed(0)}/分</span>
              </button>
            ) : null}
            <p className="mt-2 text-xs leading-snug text-subtle">运货最优只看带托盘的方案。满座载人单独标最快。</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl hud-glass px-2.5 pt-1.5 pb-2 shadow-border desk:gap-2 desk:p-2">
        <div className="flex w-full flex-col desk:hidden">
          <button type="button" className="flex w-full flex-col" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <span className="hud-handle" />
          </button>
          <div className="flex items-center gap-2 py-0.5">
            <button
              type="button"
              title="切换我方"
              onClick={cycleOrigin}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold",
                originFaction ? originFaction.chipOn : "bg-hud-2",
              )}
            >
              {originFaction ? <GameIcon name={originFaction.id} className="size-4" /> : null}
              {originName}
            </button>
            <span className="text-subtle">→</span>
            <span className="min-w-0 truncate text-sm font-medium">{destName}</span>
            {ready ? <span className="hidden font-mono text-xs tabular-nums text-subtle min-[380px]:inline">{distanceKm.toFixed(1)} km</span> : null}
            <button type="button" className="ml-auto flex items-center gap-1" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              <span className={cn("shrink-0 font-mono text-xl leading-none font-medium tabular-nums", !ready ? "text-muted" : trip.net >= 0 ? "text-ok" : "text-danger")}>
                {ready ? money(trip.net) : "—"}
              </span>
              <ChevronUp className={cn("size-4 shrink-0 text-muted transition-transform duration-(--motion-quick)", open ? "rotate-180" : "rotate-90")} />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "hud-peek-extra grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 desk:hidden",
            open ? "hidden" : "grid",
          )}
        >
          <button
            type="button"
            onClick={() => setSheet("vehicle")}
            className="flex h-12 min-w-0 items-center gap-1.5 rounded-lg bg-hud-2 px-2 text-left"
          >
            <VehicleGlyph id={vehicle.id} className="h-10 w-16 shrink-0" />
            <span className="min-w-0 truncate text-sm font-medium">{vehicle.nameZh}</span>
          </button>
          <button type="button" onClick={() => setSheet("cargo")} className="flex h-12 min-w-0 items-center gap-1.5 rounded-lg bg-hud-2 px-2 text-left">
            {bedItems.length ? (
              bedItems.slice(0, 2).map((item, i) => (item ? <CargoGlyph key={`${item.id}-${i}`} item={item} className="-ml-1 h-9 w-9 first:ml-0" /> : null))
            ) : (
              <span className="text-xs text-subtle">空斗</span>
            )}
            <span className="min-w-0 truncate text-sm font-medium">{cargoLabel(cargoIds)}</span>
          </button>
          {bestPlan ? (
            <button
              type="button"
              onClick={() => applyPlan(bestPlan)}
              className={cn("inline-flex h-12 items-center rounded-lg px-3 text-sm font-semibold", alreadyBest ? "bg-hud-2 text-muted" : "bg-ok text-bg")}
            >
              {alreadyBest ? "已最优" : "最优"}
            </button>
          ) : (
            <span className="inline-flex h-12 items-center px-2 text-xs text-subtle">选点</span>
          )}
        </div>

        <div className={cn("flex flex-col gap-3", !open && "compact:hidden")}>
          <div className="hud-section">
            <p className="hud-section-label desk:hidden">我方出生</p>
            <div className="chip-scroll desk:flex-wrap">
              <button
                type="button"
                title="点选出发"
                onClick={() => onPlaceMode("gun")}
                className={cn("inline-flex size-11 items-center justify-center rounded-md", placeMode === "gun" ? "bg-accent text-accent-fg" : "bg-hud-2 text-fg hover:bg-fg/10")}
              >
                <GameIcon name="spawn_vehicle" className="size-5" />
              </button>
              <span className="hidden px-1 text-xs font-medium tracking-wide text-muted desk:inline">我方</span>
              {fobs.map((stop) =>
                stop.fobId ? <FactionChip key={stop.id} id={stop.fobId} on={originId === stop.id} onClick={() => onPickOrigin(stop)} /> : null,
              )}
            </div>
          </div>

          <div className="hud-section">
            <p className="hud-section-label desk:hidden">卸货点</p>
            <div className="chip-scroll desk:flex-wrap">
              <button
                type="button"
                title="点选卸货"
                onClick={() => onPlaceMode("target")}
                className={cn("inline-flex size-11 items-center justify-center rounded-md", placeMode === "target" ? "bg-accent text-accent-fg" : "bg-hud-2 text-fg hover:bg-fg/10")}
              >
                <GameIcon name="fob" className="size-5" />
              </button>
              <span className="hidden px-1 text-xs font-medium tracking-wide text-muted desk:inline">卸货</span>
              <button
                type="button"
                title="己方前线 FOB · 投放 + 卸进库"
                onClick={() => onPickDest(front)}
                className={cn(
                  "inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold",
                  destId === FRONT_FOB_ID ? "bg-ok text-bg" : "bg-hud-2 text-fg hover:bg-fg/10",
                )}
              >
                <GameIcon name="fob" className="size-5" />
                前线FOB
              </button>
              {towers.map((stop) => (
                <button
                  key={stop.id}
                  type="button"
                  title={`${stop.label} · 战区投放`}
                  onClick={() => onPickDest(stop)}
                  className={cn("inline-flex h-11 items-center gap-1 rounded-md px-2.5 text-sm font-medium", destId === stop.id ? "bg-accent text-accent-fg" : "bg-hud-2 text-fg hover:bg-fg/10")}
                >
                  <GameIcon name="tower" className="size-4" />
                  {stop.short}
                </button>
              ))}
              <button
                type="button"
                title="点选战区"
                onClick={() => onPlaceMode("zone")}
                className={cn("inline-flex size-11 items-center justify-center rounded-md", placeMode === "zone" ? "bg-accent text-accent-fg" : "bg-hud-2 text-fg hover:bg-fg/10")}
              >
                <SquareDashed className="size-4" />
              </button>
              <button type="button" className="h-11 rounded-md px-2.5 text-xs text-muted hover:bg-fg/10 hover:text-fg" onClick={onResetRoute}>
                回前线
              </button>
              {ready ? <span className="ml-auto hidden font-mono text-xs tabular-nums text-subtle desk:inline">{distanceKm.toFixed(1)} km</span> : null}
            </div>
          </div>

          <div className="hud-section">
            <p className="hud-section-label desk:hidden">载具与货物</p>
            <div className="grid grid-cols-2 gap-1.5 desk:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <button
                type="button"
                onClick={() => setSheet("vehicle")}
                className="flex h-12 min-w-0 items-center gap-2 rounded-lg bg-hud-2 px-2 text-left hover:bg-fg/10 desk:h-14"
              >
                <VehicleGlyph id={vehicle.id} className="h-10 w-16 shrink-0 desk:h-12 desk:w-20" />
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs tracking-wide text-muted">{NAME_EN[vehicle.id]}</span>
                  <span className="block truncate text-sm font-medium">{vehicle.nameZh}</span>
                </span>
                <span className="ml-auto hidden shrink-0 font-mono text-sm tabular-nums text-ok sm:inline">{money(vehicle.price)}</span>
              </button>
              <button
                type="button"
                onClick={() => setSheet("cargo")}
                className="flex h-12 min-w-0 items-center gap-2 rounded-lg bg-hud-2 px-2 text-left hover:bg-fg/10 desk:h-14 desk:px-3"
              >
                <span className="flex shrink-0 items-center">
                  {bedItems.length ? (
                    bedItems.slice(0, 3).map((item, i) => (item ? <CargoGlyph key={`${item.id}-${i}`} item={item} className="-ml-1 h-8 w-9 first:ml-0" /> : null))
                  ) : (
                    <span className="text-xs text-subtle">空斗</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="hidden font-mono text-xs tracking-wide text-muted uppercase desk:block">Logistics</span>
                  <span className="block truncate text-sm font-medium">{cargoLabel(cargoIds)}</span>
                </span>
                <span className="ml-auto hidden shrink-0 text-xs text-subtle desk:inline">
                  {bed.palletSlots ? `${bed.w}×${bed.h}` : bed.crateSlots ? `${bed.crateSlots}箱位` : "无斗"}
                </span>
              </button>
              <div className="col-span-2 flex flex-wrap items-center gap-1.5 desk:col-span-1">
                {(["fob", "zone", "field"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => onDestKind(kind)}
                    className={cn("h-11 rounded-md px-3 text-sm font-medium", destKind === kind ? "bg-accent text-accent-fg" : "bg-hud-2 text-fg hover:bg-fg/10")}
                  >
                    {destLabel(kind)}
                  </button>
                ))}
                <Stepper label="乘客" value={passengers} onChange={onPassengers} max={vehicle.passengers} />
                <Stepper label="连跑" value={trips} onChange={onTrips} min={1} max={8} />
                <Toggle on={roundTrip} onClick={() => onRoundTrip(!roundTrip)}>
                  往返
                </Toggle>
                <Toggle on={ownedVehicle} onClick={() => onOwnedVehicle(!ownedVehicle)}>
                  车已买
                </Toggle>
              </div>
            </div>
          </div>

          {bestPlan ? (
            <button
              type="button"
              onClick={() => applyPlan(bestPlan)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left",
                alreadyBest ? "bg-hud-2" : "bg-ok/15 hover:bg-ok/25",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <VehicleGlyph id={bestPlan.vehicle.id} className="hidden h-12 w-20 shrink-0 desk:block" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                    {alreadyBest ? "已是最优" : "一键最优"} · {originName} → {bestPlan.stop.short}
                  </span>
                  <span className="block truncate text-sm font-medium">
                    {bestPlan.vehicle.nameZh} · {bestPlan.roundTrip ? "往返" : "单程"} · {modeLabel(bestPlan.mode)} · {bestPlan.trip.palletsLoaded}托
                    {bestPlan.trip.passengersLoaded ? ` ${bestPlan.trip.passengersLoaded}人` : ""}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={cn("block font-mono text-lg tabular-nums desk:text-xl", bestPlan.session.sessionNet >= 0 ? "text-ok" : "text-danger")}>
                  {money(bestPlan.session.sessionNet)}
                </span>
                <span className="block font-mono text-xs tabular-nums text-muted">
                  {trips}趟 · {bestPlan.session.sessionPerMin.toFixed(0)}/分
                </span>
              </span>
            </button>
          ) : null}

          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
              <p className={cn("font-mono text-2xl leading-none font-medium tracking-tight tabular-nums desk:text-4xl", !ready ? "text-muted" : trip.net >= 0 ? "text-ok" : "text-danger")}>
                {ready ? money(trip.net) : "—"}
                <span className="ml-1 text-xs font-normal text-muted desk:text-sm">本趟</span>
              </p>
              {ready ? (
                <>
                  <p className={cn("font-mono text-lg tabular-nums desk:text-2xl", session.sessionNet >= 0 ? "text-ok" : "text-danger")}>
                    {money(session.sessionNet)}
                    <span className="ml-1 text-xs font-normal text-muted">{trips}趟</span>
                  </p>
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="font-mono text-sm tabular-nums text-muted">之后每趟 {money(session.rest.net)}</p>
                    <p className="font-mono text-sm tabular-nums text-muted">{trip.minutes.toFixed(1)} 分</p>
                    {trip.overRange ? <Badge variant="warn">超航程 加油 {trip.refuelStops} 次</Badge> : null}
                    {trip.breakEvenTrips ? <Badge variant={trip.net >= 0 ? "ok" : "warn"}>回本 {trip.breakEvenTrips} 趟</Badge> : <Badge variant="danger">回不了本</Badge>}
                    {showDestKindSwap ? (
                      <button type="button" onClick={() => onDestKind("fob")} className="rounded-md bg-ok/15 px-2 py-1 text-xs font-medium text-ok hover:bg-ok/25">
                        改用 FOB 卸货 {money(dests[0].net)}
                      </button>
                    ) : null}
                    {showRouteSwap ? (
                      <button type="button" onClick={() => onPickDest(bestRoute.stop)} className="rounded-md bg-ok/15 px-2 py-1 text-xs font-medium text-ok hover:bg-ok/25">
                        航线改去 {bestRoute.stop.short} {money(bestRoute.session.sessionNet)}
                      </button>
                    ) : null}
                    {showLoadSwap ? (
                      <button type="button" onClick={() => onVehicleId(bestLoad.first.vehicleId)} className="rounded-md bg-ok/15 px-2 py-1 text-xs font-medium text-ok hover:bg-ok/25">
                        这趟改用 {bestLoadName} {money(bestLoad.sessionNet)}
                      </button>
                    ) : null}
                  </span>
                </>
              ) : (
                <p className="text-sm text-subtle">红蓝绿是出生点，卸货默认前线 FOB。</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" disabled={!ready} onClick={() => onCopy(chat)} className="compact:px-2">
                <Copy />
                <span className="hidden sm:inline desk:inline">复制账本</span>
              </Button>
              <Button size="sm" variant="secondary" className="bg-hud-2" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                <ChevronUp className={cn("size-4 transition-transform duration-(--motion-quick)", open ? "rotate-180" : "")} />
                {open ? "收起" : "更多"}
              </Button>
            </div>
          </div>
          {ready ? <CostLine trip={trip} restNet={session.rest.net} trips={trips} /> : null}
          <p className="px-1 text-xs leading-snug text-subtle">
            托盘买 $400 · 投放 $2,500 · FOB 入库 +$1,800 · 载人落地 $375 / 空投 $750 · 存活 +$500
          </p>

          {open ? (
            <div className="grid gap-2 desk:hidden">
              <div className="rounded-lg bg-hud-2 p-3">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">地图航线</p>
                <ul className="flex flex-col gap-1">
                  {mapRoutes.map((row) => (
                    <li key={row.stop.id}>
                      <button
                        type="button"
                        onClick={() => onPickDest(row.stop)}
                        className={cn("flex w-full items-baseline justify-between rounded-md py-1.5 text-left", row.stop.id === destId ? "text-fg" : "text-muted")}
                      >
                        <span className="text-sm">
                          {row.stop.short}
                          <span className="ml-1 text-xs text-subtle">{row.distanceKm.toFixed(1)} km</span>
                        </span>
                        <span className={cn("font-mono text-sm tabular-nums", row.session.sessionNet >= 0 ? "text-ok" : "text-danger")}>{money(row.session.sessionNet)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-hud-2 p-3">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">联合搜索</p>
                <ul className="flex flex-col gap-1">
                  {uniquePlans(haulPool, 5).map((plan, i) => (
                    <li key={planKey(plan)}>
                      <button type="button" onClick={() => applyPlan(plan)} className="flex w-full items-baseline justify-between rounded-md py-1.5 text-left">
                        <span className="min-w-0 truncate text-sm">
                          {i + 1}. {plan.vehicle.nameZh} · {plan.stop.short}
                        </span>
                        <span className={cn("shrink-0 font-mono text-sm tabular-nums", plan.session.sessionNet >= 0 ? "text-ok" : "text-danger")}>{money(plan.session.sessionNet)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CostLine({ trip, restNet, trips }: { trip: TripBreakdown; restNet: number; trips: number }) {
  const bits = [
    trip.spawnCost ? `买车 ${money(trip.spawnCost)}` : "车已买",
    trip.palletCost ? `托盘 ${money(trip.palletCost)}` : null,
    trip.extraCost ? `货箱/物品 ${money(trip.extraCost)}` : null,
    `油 ${money(trip.fuelCost)} · ${trip.driveKm.toFixed(1)} km`,
    trip.refuelStops ? `加油 ${trip.refuelStops} 次` : null,
    trip.handlingMinutes > 0.05 ? `装卸 ${trip.handlingMinutes.toFixed(1)} 分` : null,
    trip.palletDrop ? `投放 ${money(trip.palletDrop)}` : null,
    trip.palletUnload ? `入库 ${money(trip.palletUnload)}` : null,
    trip.passengerDrop ? `载人 ${money(trip.passengerDrop)}` : null,
    trip.passengerSurvive ? `存活 ${money(trip.passengerSurvive)}` : null,
    trip.passengerKills ? `击杀奖 ${money(trip.passengerKills)}` : null,
    trips > 1 ? `之后每趟 ${money(restNet)}` : null,
  ].filter(Boolean);
  return <p className="px-1 font-mono text-xs tabular-nums text-subtle">{bits.join(" · ")}</p>;
}
