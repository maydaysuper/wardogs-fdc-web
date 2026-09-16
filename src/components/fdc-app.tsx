import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BookmarkPlus,
  ChevronUp,
  Copy,
  Crosshair,
  Locate,
  RotateCcw,
  SquareDashed,
  Target,
  Trash2,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TacticalMap } from "@/components/tactical-map";
import { HaulHud } from "@/components/haul-hud";
import { formatSolutionChat, solveWeapon, type FireSolution } from "@/lib/fire/ballistics";
import {
  azimuthDeg,
  distanceMeters,
  formatXy,
  gridRef,
  parsePair,
  type Vec,
} from "@/lib/fire/coords";
import { useFdc } from "@/lib/fire/store";
import { WEAPONS, type WeaponId } from "@/lib/fire/tables";
import { MAPS } from "@/lib/fire/maps";
import { allStops, defaultHaulRoute, getFobStops, getHaulDestinations, matchStop } from "@/lib/haul/routes";
import {
  DEFAULT_CONTROL_ZONE_DIAMETER_METERS,
  getZonePlacement,
  getZonePlacements,
  zoneDiameterMeters,
} from "@/lib/fire/zones";
import { cn } from "@/lib/utils";

function padAz(deg: number): string {
  const n = ((deg % 360) + 360) % 360;
  return n.toFixed(1).padStart(5, "0");
}

function statusLabel(sol: FireSolution): { text: string; variant: "ok" | "warn" | "danger" | "default" } {
  switch (sol.status) {
    case "ok":
      return { text: "射界内", variant: "ok" };
    case "edge":
      return { text: "边缘射表 · 首发校正", variant: "warn" };
    case "too-close":
      return { text: "过近", variant: "danger" };
    case "out-of-range":
      return { text: "超射距", variant: "danger" };
    default:
      return { text: "待输入", variant: "default" };
  }
}

function Compass({ deg }: { deg: number | null }) {
  const rot = deg ?? 0;
  const fx = (n: number) => Math.round(n * 1000) / 1000;
  return (
    <svg viewBox="0 0 80 80" className="size-14 shrink-0 text-muted" aria-hidden>
      <circle cx="40" cy="40" r="36" className="fill-none stroke-line" strokeWidth="1.2" />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i * 15 * Math.PI) / 180;
        const inner = i % 6 === 0 ? 28 : 32;
        return (
          <line
            key={i}
            x1={fx(40 + Math.sin(a) * inner)}
            y1={fx(40 - Math.cos(a) * inner)}
            x2={fx(40 + Math.sin(a) * 36)}
            y2={fx(40 - Math.cos(a) * 36)}
            className={i % 6 === 0 ? "stroke-muted" : "stroke-line"}
            strokeWidth={i % 6 === 0 ? 1.4 : 0.8}
          />
        );
      })}
      <text x="40" y="16" textAnchor="middle" className="fill-fg" fontSize="8" fontFamily="IBM Plex Mono, monospace">
        N
      </text>
      {deg != null ? (
        <line
          x1="40"
          y1="40"
          x2={fx(40 + Math.sin((rot * Math.PI) / 180) * 26)}
          y2={fx(40 - Math.cos((rot * Math.PI) / 180) * 26)}
          className="stroke-accent"
          strokeWidth="2.2"
        />
      ) : null}
    </svg>
  );
}

export function FdcApp() {
  const s = useFdc();
  const [details, setDetails] = useState(false);
  const zoneCenter = s.zoneCenters?.[s.mapId] ?? null;
  const zonePlacementId = s.zonePlacementIds?.[s.mapId] ?? null;
  const zonePlacement = getZonePlacement(s.mapId, zonePlacementId);
  const zonePlacements = getZonePlacements(s.mapId);
  const zoneDiameterM =
    s.zoneDiameters?.[s.mapId] ?? zoneDiameterMeters(s.mapId, zonePlacementId) ?? DEFAULT_CONTROL_ZONE_DIAMETER_METERS;

  useEffect(() => {
    const result = useFdc.persist.rehydrate();
    void Promise.resolve(result).then(() => {
      const state = useFdc.getState();
      const map = MAPS[state.mapId];
      const zone = state.zoneCenters?.[state.mapId] ?? null;
      const originStop = getFobStops(map).find((stop) => stop.id === state.haulOriginId) ?? allStops(map, zone).find((stop) => stop.id === state.haulOriginId);
      const destStop = allStops(map, zone).find((stop) => stop.id === state.haulDestId);
      if (originStop && destStop && !destStop.id.startsWith("fob-")) {
        state.setHaulOrigin(originStop.pos, originStop.id);
        state.setHaulDest(destStop.pos, destStop.id, destStop.destKind);
        return;
      }
      const fallback = defaultHaulRoute(map, zone, originStop?.id ?? state.haulOriginId);
      state.setHaulOrigin(fallback.origin.pos, fallback.origin.id);
      state.setHaulDest(fallback.dest.pos, fallback.dest.id, fallback.dest.destKind);
    });
  }, []);

  const computed = useMemo(() => {
    if (s.inputMode === "range") {
      const range = Number.parseFloat(s.rangeText);
      return solveWeapon(s.weapon, range, s.dH, null);
    }
    if (!s.gun || !s.target) return solveWeapon(s.weapon, Number.NaN, s.dH, null);
    const rangeM = distanceMeters(s.gun, s.target) + s.adjustRange;
    const az = azimuthDeg(s.gun, s.target) + s.adjustAz;
    return solveWeapon(s.weapon, rangeM, s.dH, az);
  }, [s.inputMode, s.rangeText, s.gun, s.target, s.weapon, s.dH, s.adjustRange, s.adjustAz]);

  const st = statusLabel(computed);
  const primary =
    (s.arcPreference === "auto" ? null : computed.arcs.find((a) => a.arc === s.arcPreference)) ??
    computed.arcs[0] ??
    null;
  const recommendedWeapon = useMemo(() => {
    if (!Number.isFinite(computed.rangeM) || computed.rangeM <= 0) return null;
    if (computed.status === "ok" || computed.status === "edge") return null;
    return (Object.keys(WEAPONS) as WeaponId[]).find((id) => {
      if (id === s.weapon) return false;
      const alt = solveWeapon(id, computed.rangeM, s.dH, computed.azimuthDeg);
      return alt.status === "ok" || alt.status === "edge";
    }) ?? null;
  }, [computed.rangeM, computed.status, computed.azimuthDeg, s.weapon, s.dH]);

  const copySol = async () => {
    const coordLine =
      s.inputMode === "coord" && s.gun && s.target
        ? `炮位 ${formatXy(s.gun)}  →  目标 ${formatXy(s.target)}`
        : null;
    const text = [formatSolutionChat(computed, primary?.arc ?? null), coordLine].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("诸元已复制");
    } catch {
      toast("复制失败");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "1") {
        useFdc.getState().setWeapon("l81");
        useFdc.getState().setArcPreference("auto");
      }
      if (e.key === "2") useFdc.getState().setWeapon("sph2");
      if (e.key === "g" || e.key === "G") useFdc.getState().setPlaceMode("gun");
      if (e.key === "t" || e.key === "T") useFdc.getState().setPlaceMode("target");
      if (e.key === "z" || e.key === "Z") useFdc.getState().setPlaceMode("zone");
      if (e.key === "c" || e.key === "C") void copySol();
      if (e.key === "h" || e.key === "H") useFdc.getState().setPanel("haul");
      if (e.key === "f" || e.key === "F") useFdc.getState().setPanel("fire");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [computed, primary]);

  const place = (p: Vec, modeOverride?: "gun" | "target" | "zone") => {
    const mode = modeOverride ?? s.placeMode;
    if (s.panel === "haul") {
      const map = MAPS[s.mapId];
      const zone = zoneCenter;
      if (mode === "gun") {
        const stop = getFobStops(map).find((item) => distanceMeters(item.pos, p) <= 80) ?? null;
        s.setHaulOrigin(stop?.pos ?? p, stop?.id ?? "custom");
        s.setPlaceMode("target");
        toast(`我方 ${stop ? stop.short : formatXy(p)}`);
        return;
      }
      if (mode === "zone") {
        s.setZoneCenter(p);
        s.setHaulDest(p, "front-fob", "fob");
        toast(`前线 FOB · 战区中心 ${formatXy(p)}`);
        return;
      }
      const stop =
        getHaulDestinations(map, s.haulOriginId, zone).find((item) => distanceMeters(item.pos, p) <= 120) ??
        matchStop(map, p, 80, zone);
      if (stop && !stop.id.startsWith("fob-")) {
        s.setHaulDest(stop.pos, stop.id, stop.destKind);
        toast(`卸货 ${stop.short}`);
      } else {
        s.setHaulDest(p, "custom", s.destKind === "fob" ? "field" : s.destKind);
        toast(`卸货 ${formatXy(p)}`);
      }
      return;
    }
    if (mode === "zone") {
      s.setZoneCenter(p);
      s.setPlaceMode("target");
      toast(`战区中心已校准 · ${formatXy(p)}`);
      return;
    }
    s.setInputMode("coord");
    if (mode === "gun") {
      s.setGun(p);
      s.setPlaceMode("target");
    } else {
      s.setTarget(p);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden text-fg">
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          className: "font-sans !bg-hud-2 !text-fg !border-0 !shadow-[0_0_0_1px_rgb(244_241_228_/_0.16)]",
        }}
      />

      <div className="absolute inset-0">
        <TacticalMap
          mapId={s.mapId}
          panel={s.panel}
          gun={s.panel === "haul" ? s.haulOrigin : s.gun}
          target={s.panel === "haul" ? s.haulDest : s.target}
          zoneCenter={zoneCenter}
          zoneDiameterM={zoneDiameterM}
          zonePlacementId={zonePlacementId}
          weapon={s.weapon}
          placeMode={s.placeMode}
          onPlace={place}
          onMapId={s.setMapId}
        />
      </div>

      <header className="pointer-events-none absolute z-30 safe-hud-t">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg hud-glass px-1 py-1 shadow-border desk:gap-2 desk:px-2 desk:py-1.5">
          <Crosshair className="ml-1 hidden size-4 text-accent desk:block" strokeWidth={1.75} />
          <h1 className="hidden text-sm font-semibold tracking-tight desk:block">WARDOGS 诸元</h1>
          <span className="hidden font-mono text-[10px] text-subtle desk:inline">0916e</span>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-hud-2 p-0.5">
            <button
              type="button"
              onClick={() => s.setPanel("fire")}
              className={cn("h-11 rounded-sm px-3 text-sm font-medium desk:h-8 desk:px-2.5 desk:text-xs", s.panel === "fire" ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10")}
            >
              火力
            </button>
            <button
              type="button"
              onClick={() => s.setPanel("haul")}
              className={cn("h-11 rounded-sm px-3 text-sm font-medium desk:h-8 desk:px-2.5 desk:text-xs", s.panel === "haul" ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10")}
            >
              运输
            </button>
          </div>
          <div className="hidden items-center gap-0.5 rounded-md bg-hud-2 p-0.5 desk:flex">
            {(Object.keys(MAPS) as Array<keyof typeof MAPS>).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => s.setMapId(id)}
                className={cn(
                  "h-8 rounded-sm px-2.5 text-xs font-medium",
                  s.mapId === id ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10",
                )}
              >
                {MAPS[id].nameZh}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 safe-hud-b">
        <div className="pointer-events-auto mx-auto flex w-full max-w-6xl flex-col gap-2">
          {s.panel === "haul" ? (
            <HaulHud
                mapId={s.mapId}
                origin={s.haulOrigin}
                dest={s.haulDest}
                originId={s.haulOriginId}
                destId={s.haulDestId}
                vehicleId={s.vehicleId}
                destKind={s.destKind}
                pallets={s.pallets}
                passengers={s.passengers}
                roundTrip={s.roundTrip}
                ownedVehicle={s.ownedVehicle}
                unloadAtFob={s.unloadAtFob}
                expectSurvive={s.expectSurvive}
                expectKills={s.expectKills}
                trips={s.haulTrips}
                distanceKm={s.haulOrigin && s.haulDest ? distanceMeters(s.haulOrigin, s.haulDest) / 1000 : 0}
                cargoIds={s.cargoIds ?? []}
                zoneCenter={zoneCenter}
                placeMode={s.placeMode}
                onPlaceMode={s.setPlaceMode}
                onVehicleId={s.setVehicleId}
                onDestKind={s.setDestKind}
                onPallets={s.setPallets}
                onPassengers={s.setPassengers}
                onRoundTrip={s.setRoundTrip}
                onOwnedVehicle={s.setOwnedVehicle}
                onUnloadAtFob={s.setUnloadAtFob}
                onExpectSurvive={s.setExpectSurvive}
                onExpectKills={s.setExpectKills}
                onTrips={s.setHaulTrips}
                onCargoIds={s.setCargoIds}
                onPickOrigin={(stop) => {
                  s.setHaulOrigin(stop.pos, stop.id);
                  s.setPlaceMode("target");
                }}
                onPickDest={(stop) => {
                  s.setHaulDest(stop.pos, stop.id, stop.destKind);
                }}
                onResetRoute={s.resetHaulRoute}
                onCopy={async (text) => {
                  try {
                    await navigator.clipboard.writeText(text);
                    toast("账本已复制");
                  } catch {
                    toast("复制失败");
                  }
                }}
              />
          ) : (
            <>
          {details ? (
            <div className="fdc-details grid gap-3 rounded-xl hud-glass p-3 shadow-border desk:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-hud-2 p-3">
                <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-hud p-1">
                  <button
                    type="button"
                    onClick={() => s.setInputMode("coord")}
                    className={cn(
                      "h-9 rounded-md text-sm font-medium",
                      s.inputMode === "coord" ? "bg-accent text-accent-fg" : "text-fg",
                    )}
                  >
                    敌我坐标
                  </button>
                  <button
                    type="button"
                    onClick={() => s.setInputMode("range")}
                    className={cn(
                      "h-9 rounded-md text-sm font-medium",
                      s.inputMode === "range" ? "bg-accent text-accent-fg" : "text-fg",
                    )}
                  >
                    已知距离
                  </button>
                </div>
                {s.inputMode === "range" ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
                      炮目距离（米）
                    </span>
                    <Input
                      value={s.rangeText}
                      inputMode="numeric"
                      placeholder="400"
                      onChange={(e) => s.setRangeText(e.target.value)}
                      className="text-lg"
                    />
                  </label>
                ) : (
                  <div className="flex flex-col gap-3">
                    <CoordField
                      label="我炮坐标"
                      tone="gun"
                      value={s.gunText}
                      onCommit={(p, raw) => {
                        if (p) s.setGun(p, raw);
                        else s.setGunText(raw);
                      }}
                      hint={s.gun ? `格网 ${gridRef(s.gun)} · ${formatXy(s.gun)}` : "游戏内 X Y，1 单位 = 100 m"}
                    />
                    <CoordField
                      label="目标坐标"
                      tone="tgt"
                      value={s.targetText}
                      onCommit={(p, raw) => {
                        if (p) s.setTarget(p, raw);
                        else s.setTargetText(raw);
                      }}
                      hint={s.target ? `格网 ${gridRef(s.target)} · ${formatXy(s.target)}` : "粘贴队友标点，或地图点选"}
                    />
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1 bg-hud" onClick={s.swap}>
                        <ArrowLeftRight />
                        对调
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1" onClick={s.clearTarget}>
                        清目标
                      </Button>
                    </div>
                  </div>
                )}
                <div className="mt-3 border-t border-line pt-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium tracking-wide text-muted uppercase">Control Zone 战区</span>
                    <button
                      type="button"
                      className="text-[0.6875rem] text-subtle hover:text-fg disabled:opacity-40"
                      disabled={!zoneCenter}
                      onClick={() => s.clearZone()}
                    >
                      清除中心
                    </button>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {zonePlacements.map((placement) => {
                      const selected = placement.id === zonePlacementId;
                      const legacy = placement.status === "never-rolled";
                      return (
                        <button
                          key={placement.id}
                          type="button"
                          title={placement.note ?? `${placement.region} / ${placement.label}`}
                          onClick={() => s.setZonePlacement(placement.id)}
                          className={cn(
                            "rounded-md px-2 py-1 text-[0.6875rem] font-medium",
                            selected ? "bg-zone text-bg" : "bg-hud text-fg hover:bg-fg/10",
                            legacy && !selected ? "border border-dashed border-zone/60 text-zone/70" : "",
                          )}
                        >
                          {placement.region}/{placement.label}{legacy ? " · 不轮换" : ""}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-[1fr_7rem] gap-2">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[0.6875rem] text-subtle">战区中心 X Y</span>
                      <Input
                        key={`${s.mapId}-${zoneCenter?.x ?? "none"}-${zoneCenter?.y ?? "none"}`}
                        defaultValue={zoneCenter ? formatXy(zoneCenter) : ""}
                        placeholder="地图点选或输入 80.00 70.00"
                        className="font-mono text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                        }}
                        onBlur={(e) => {
                          const raw = e.currentTarget.value.trim();
                          if (!raw) {
                            s.clearZone();
                            return;
                          }
                          const parsed = parsePair(raw);
                          if (!parsed) {
                            toast("战区中心坐标格式错误");
                            return;
                          }
                          s.setZoneCenter(parsed);
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[0.6875rem] text-subtle">直径 m</span>
                      <Input
                        key={`${s.mapId}-${zonePlacementId ?? "custom"}-${Math.round(zoneDiameterM)}`}
                        defaultValue={Math.round(zoneDiameterM)}
                        inputMode="numeric"
                        className="font-mono text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                        }}
                        onBlur={(e) => {
                          const next = Number.parseFloat(e.currentTarget.value);
                          s.setZoneDiameter(Number.isFinite(next) ? next : DEFAULT_CONTROL_ZONE_DIAMETER_METERS);
                        }}
                      />
                    </label>
                  </div>
                  <p className="mt-1.5 text-[0.625rem] leading-relaxed text-subtle">
                    {zonePlacement
                      ? `${zonePlacement.region} / ${zonePlacement.label}${zonePlacement.status === "never-rolled" ? "：BETA 2 当前不会随机到此战区。" : ""}`
                      : "先按服务器/游戏内名称选择轮换，再点圆心；圆内塔会自动高亮。"}
                  </p>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
                    高差 ΔH（目标 − 我炮，米）
                  </span>
                  <Input
                    value={Number.isFinite(s.dH) ? String(s.dH) : "0"}
                    inputMode="numeric"
                    onChange={(e) => s.setDH(Number.parseFloat(e.target.value) || 0)}
                  />
                </label>
              </div>

              <div className="rounded-lg bg-hud-2 p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.6875rem] font-medium tracking-wider text-muted uppercase">射角</p>
                    <p
                      className={cn(
                        "font-mono text-5xl leading-none font-medium tracking-tight tabular-nums",
                        computed.status === "ok" || computed.status === "edge" ? "text-accent" : "text-danger",
                      )}
                    >
                      {primary ? primary.mils : "—"}
                      <span className="ml-1 text-lg font-normal text-muted">密位</span>
                    </p>
                  </div>
                  <Compass deg={computed.azimuthDeg} />
                </div>
                <p className="mb-2 font-mono text-[0.6875rem] text-subtle">
                  {WEAPONS[s.weapon].name} · 射表 {WEAPONS[s.weapon].minRange}–{WEAPONS[s.weapon].maxRange} m · 装填 {WEAPONS[s.weapon].reloadS}s
                </p>
                {s.weapon === "sph2" ? (
                  <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-hud p-1">
                    {([
                      ["auto", "自动"],
                      ["low", "低弹"],
                      ["high", "高弹"],
                    ] as const).map(([id, label]) => {
                      const unavailable = id !== "auto" && !computed.arcs.some((a) => a.arc === id);
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={unavailable}
                          onClick={() => s.setArcPreference(id)}
                          className={cn(
                            "h-8 rounded-md text-xs font-medium disabled:cursor-not-allowed disabled:opacity-30",
                            s.arcPreference === id ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="方位" value={computed.azimuthDeg == null ? "—" : `${padAz(computed.azimuthDeg)}°`} />
                  <Stat
                    label="方向密位"
                    value={computed.dirMils == null ? "—" : String(Math.round(computed.dirMils))}
                  />
                  <Stat
                    label="距离"
                    value={Number.isFinite(computed.rangeM) && computed.rangeM > 0 ? `${Math.round(computed.rangeM)} m` : "—"}
                  />
                  <Stat label="落弹" value={primary ? `约 ${primary.timeOfFlightS.toFixed(0)} s` : "—"} />
                  <Stat label="高差修正" value={primary ? `${primary.mils - primary.tableMils >= 0 ? "+" : ""}${primary.mils - primary.tableMils} 密位` : "—"} />
                  <Stat label="散布" value={computed.groupingM > 0 ? `±${computed.groupingM.toFixed(1)} m` : "—"} />
                </div>
                {computed.arcs.length > 1 ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {computed.arcs.map((a) => (
                      <div key={a.arc} className="rounded-md bg-hud px-3 py-2">
                        <p className="text-[0.6875rem] text-muted">{a.arc === "low" ? "低弹 · 更快" : "高弹 · 越障"}</p>
                        <p className="font-mono text-2xl tabular-nums text-accent">
                          {a.mils}
                          <span className="ml-1 text-xs text-muted">密位</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg bg-hud-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium tracking-wide text-muted uppercase">弹着修正</p>
                  {s.adjustRange !== 0 || s.adjustAz !== 0 ? (
                    <button type="button" className="text-xs text-muted hover:text-fg" onClick={s.resetAdjust}>
                      <span className="inline-flex items-center gap-1">
                        <RotateCcw className="size-3.5" /> 复位
                      </span>
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <Button variant="secondary" size="sm" className="bg-hud" onClick={() => s.addAdjust(10, 0)}>
                    近 +10
                  </Button>
                  <Button variant="secondary" size="sm" className="bg-hud" onClick={() => s.addAdjust(25, 0)}>
                    近 +25
                  </Button>
                  <Button variant="secondary" size="sm" className="bg-hud" onClick={() => s.addAdjust(-10, 0)}>
                    远 −10
                  </Button>
                  <Button variant="secondary" size="sm" className="bg-hud" onClick={() => s.addAdjust(-25, 0)}>
                    远 −25
                  </Button>
                  <Button variant="secondary" size="sm" className="bg-hud" onClick={() => s.addAdjust(0, -1)}>
                    左 1°
                  </Button>
                  <Button variant="secondary" size="sm" className="bg-hud" onClick={() => s.addAdjust(0, -3)}>
                    左 3°
                  </Button>
                  <Button variant="secondary" size="sm" className="bg-hud" onClick={() => s.addAdjust(0, 1)}>
                    右 1°
                  </Button>
                  <Button variant="secondary" size="sm" className="bg-hud" onClick={() => s.addAdjust(0, 3)}>
                    右 3°
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-hud-2 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted uppercase">快速点位</p>
                  <span className="font-mono text-[0.625rem] text-subtle">本机保存</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-hud"
                    disabled={!s.gun}
                    onClick={() => s.saveCurrent(`炮位 ${s.saved.filter((m) => m.kind === "gun").length + 1}`, "gun")}
                  >
                    <BookmarkPlus /> 保存炮位
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-hud"
                    disabled={!s.target}
                    onClick={() => s.saveCurrent(`目标 ${s.saved.filter((m) => m.kind === "target").length + 1}`, "target")}
                  >
                    <BookmarkPlus /> 保存目标
                  </Button>
                </div>
                <div className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
                  {s.saved.length === 0 ? (
                    <p className="rounded-md bg-hud px-2 py-3 text-center text-xs text-subtle">暂无保存点位</p>
                  ) : (
                    s.saved.map((mark) => (
                      <div key={mark.id} className="flex items-center gap-1 rounded-md bg-hud p-1">
                        <button
                          type="button"
                          onClick={() => s.loadMark(mark.id)}
                          className="min-w-0 flex-1 rounded px-2 py-1.5 text-left hover:bg-fg/10"
                        >
                          <span className={cn("mr-1.5 text-xs", mark.kind === "gun" ? "text-gun" : "text-tgt")}>
                            {mark.kind === "gun" ? "炮" : "标"}
                          </span>
                          <span className="text-xs font-medium">{mark.name}</span>
                          <span className="ml-1 font-mono text-[0.625rem] text-subtle">
                            {mark.mapId ? MAPS[mark.mapId].name : "旧记录"} · {formatXy(mark.pos)}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded text-subtle hover:bg-fg/10 hover:text-danger"
                          onClick={() => s.removeMark(mark.id)}
                          aria-label={`删除${mark.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className={cn("flex flex-col gap-2 rounded-xl hud-glass px-2.5 pt-1.5 pb-2 shadow-border desk:flex-row desk:items-center desk:p-2", details && "fdc-sheet-open")}>
            <button
              type="button"
              className="desk:hidden flex w-full flex-col"
              onClick={() => setDetails((v) => !v)}
              aria-expanded={details}
            >
              <span className="hud-handle" />
            </button>
            <div className="flex items-center gap-1.5">
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant={s.placeMode === "gun" ? "default" : "secondary"}
                  className={s.placeMode === "gun" ? "h-11 desk:h-9" : "h-11 bg-hud-2 desk:h-9"}
                  onClick={() => s.setPlaceMode("gun")}
                >
                  <Locate />
                  <span className="hidden min-[360px]:inline">炮位</span>
                </Button>
                <Button
                  size="sm"
                  variant={s.placeMode === "target" ? "default" : "secondary"}
                  className={s.placeMode === "target" ? "h-11 desk:h-9" : "h-11 bg-hud-2 desk:h-9"}
                  onClick={() => s.setPlaceMode("target")}
                >
                  <Target />
                  <span className="hidden min-[360px]:inline">目标</span>
                </Button>
                <Button
                  size="sm"
                  variant={s.placeMode === "zone" ? "default" : "secondary"}
                  className={cn("h-11 desk:h-9", s.placeMode === "zone" ? "" : "bg-hud-2", "compact:hidden desk:inline-flex")}
                  onClick={() => s.setPlaceMode("zone")}
                  title="Z 或 Alt+点击地图"
                >
                  <SquareDashed />
                  战区
                </Button>
              </div>
              <div className="hidden shrink-0 grid-cols-2 gap-1 rounded-lg bg-hud-2 p-1 desk:grid">
                {(Object.keys(WEAPONS) as WeaponId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      s.setWeapon(id);
                      if (id === "l81") s.setArcPreference("auto");
                    }}
                    className={cn(
                      "h-9 rounded-md px-3 text-sm font-medium",
                      s.weapon === id ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10",
                    )}
                  >
                    {WEAPONS[id].shortName}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex min-w-0 items-baseline gap-2 px-1 desk:ml-0 desk:flex-1 desk:gap-x-3">
                <p
                  className={cn(
                    "font-mono text-2xl leading-none font-medium tracking-tight tabular-nums desk:text-4xl",
                    computed.status === "ok" || computed.status === "edge" ? "text-accent" : "text-danger",
                  )}
                >
                  {primary ? primary.mils : "—"}
                  <span className="ml-1 text-xs font-normal text-muted desk:text-sm">密位</span>
                  {primary && s.weapon === "sph2" ? (
                    <span className="ml-2 hidden font-sans text-xs font-medium text-muted desk:inline">{primary.arc === "low" ? "低弹" : "高弹"}</span>
                  ) : null}
                </p>
                <p className="hidden font-mono text-base tabular-nums min-[400px]:inline desk:text-lg">
                  {computed.azimuthDeg == null ? "—" : `${padAz(computed.azimuthDeg)}°`}
                </p>
                <p className="hidden font-mono text-lg tabular-nums desk:inline">
                  {Number.isFinite(computed.rangeM) && computed.rangeM > 0 ? `${Math.round(computed.rangeM)} m` : "—"}
                </p>
                {primary ? (
                  <p className="hidden font-mono text-sm tabular-nums text-muted desk:inline">落弹 {primary.timeOfFlightS.toFixed(0)} s</p>
                ) : null}
                <Badge variant={st.variant} className="hidden desk:inline-flex">{st.text}</Badge>
                {recommendedWeapon ? (
                  <button
                    type="button"
                    onClick={() => { s.setWeapon(recommendedWeapon); s.setArcPreference("auto"); }}
                    className="rounded-md bg-danger/15 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/25"
                  >
                    改用 {WEAPONS[recommendedWeapon].shortName}
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" onClick={copySol} className="h-11 compact:px-2 desk:h-9">
                  <Copy />
                  <span className="hidden desk:inline">复制</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-11 bg-hud-2 desk:h-9"
                  onClick={() => setDetails((v) => !v)}
                  aria-expanded={details}
                >
                  <ChevronUp className={cn("size-4 transition-transform duration-(--motion-quick)", details ? "rotate-180" : "")} />
                  <span className="hidden min-[360px]:inline">{details ? "收起" : "详情"}</span>
                </Button>
              </div>
            </div>
            <div className={cn("grid-cols-2 gap-1 rounded-lg bg-hud-2 p-1 desk:hidden", details ? "grid" : "hidden")}>
              {(Object.keys(WEAPONS) as WeaponId[]).map((id) => (
                <button
                  key={`m-${id}`}
                  type="button"
                  onClick={() => {
                    s.setWeapon(id);
                    if (id === "l81") s.setArcPreference("auto");
                  }}
                  className={cn(
                    "h-11 rounded-md px-3 text-sm font-medium",
                    s.weapon === id ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10",
                  )}
                >
                  {WEAPONS[id].shortName}
                </button>
              ))}
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-hud px-3 py-2">
      <p className="text-[0.625rem] tracking-wider text-muted uppercase">{label}</p>
      <p className="font-mono text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function CoordField({
  label,
  tone,
  value,
  onCommit,
  hint,
}: {
  label: string;
  tone: "gun" | "tgt";
  value: string;
  onCommit: (p: Vec | null, raw: string) => void;
  hint: string;
}) {
  return (
    <label className="block">
      <span
        className={cn(
          "mb-1.5 block text-xs font-medium tracking-wide uppercase",
          tone === "gun" ? "text-gun" : "text-tgt",
        )}
      >
        {label}
      </span>
      <Input
        value={value}
        onChange={(e) => onCommit(parsePair(e.target.value), e.target.value)}
        placeholder="80.12  81.40"
        className="font-mono text-lg"
      />
      <span className="mt-1 block font-mono text-[0.6875rem] text-subtle">{hint}</span>
    </label>
  );
}
