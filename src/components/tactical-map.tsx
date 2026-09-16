import { ChevronDown, Crosshair, Locate, LocateFixed, Minus, Plus, Search, SquareDashed, Target } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  MAP_SIZE_UNITS,
  METERS_PER_UNIT,
  azimuthDeg,
  distanceMeters,
  formatXy,
  gridRef,
  parsePair,
  type Vec,
} from "@/lib/fire/coords";
import {
  MAPS,
  centerView,
  clampCam,
  fitHaulView,
  fitTowersView,
  fitView,
  focusView,
  getFobMarkers,
  getTowerMarkers,
  visHeight,
  TOWER_RADIUS_M,
  type Cam,
  type MapId,
  type Viewport,
} from "@/lib/fire/maps";
import {
  controlZoneBounds,
  getTowersInControlZone,
  getZonePlacement,
  zoneRadiusUnits,
} from "@/lib/fire/zones";
import { ancestorSource, canvasDpr, getBaseMap, getTile, onTilesChange, pickTileZoom, prefetchBase, TILE_PX } from "@/lib/fire/tiles";
import { WEAPONS, type WeaponId } from "@/lib/fire/tables";
import { FACTIONS, type FobId } from "@/lib/haul/factions";
import { towerCluster } from "@/lib/haul/routes";
import { GameIcon } from "@/components/game-icon";
import { cn } from "@/lib/utils";

interface TacticalMapProps {
  mapId: MapId;
  panel?: "fire" | "haul";
  gun: Vec | null;
  target: Vec | null;
  zoneCenter: Vec | null;
  zoneDiameterM: number;
  zonePlacementId: string | null;
  weapon: WeaponId;
  placeMode: "gun" | "target" | "zone";
  onPlace: (p: Vec, modeOverride?: "gun" | "target" | "zone") => void;
  onMapId: (id: MapId) => void;
}

const LETTERS = "ABCDEFGHIJKLMNOP";
const NICE_SCALES = [50, 100, 200, 250, 500, 1000, 2000, 5000];

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function wheelFactor(e: WheelEvent | React.WheelEvent, cssH: number) {
  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= 16;
  if (e.deltaMode === 2) dy *= Math.max(cssH, 1);
  return Math.exp(dy * 0.0024);
}

export function TacticalMap({
  mapId,
  panel = "fire",
  gun,
  target,
  zoneCenter,
  zoneDiameterM,
  zonePlacementId,
  weapon,
  placeMode,
  onPlace,
  onMapId,
}: TacticalMapProps) {
  const map = MAPS[mapId];
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const hoverEl = useRef<HTMLSpanElement>(null);
  const zoomEl = useRef<HTMLSpanElement>(null);
  const cam = useRef<Cam>(fitTowersView(map, MAP_SIZE_UNITS));
  const hover = useRef<Vec | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; vx: number; vy: number; moved: boolean } | null>(
    null,
  );
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; moved: boolean } | null>(null);
  const skipPlace = useRef(false);
  const clickTimer = useRef<number | null>(null);
  const zoomDrag = useRef<{ y: number; s: number; cx: number; cy: number; vx: number; vy: number } | null>(
    null,
  );
  const zoomAtRef = useRef<(cx: number, cy: number, factor: number) => void>(() => {});
  const dirty = useRef(false);
  const paintRaf = useRef(0);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const propsRef = useRef({ map, gun, target, zoneCenter, zoneDiameterM, zonePlacementId, weapon, placeMode, onPlace, panel });
  propsRef.current = { map, gun, target, zoneCenter, zoneDiameterM, zonePlacementId, weapon, placeMode, onPlace, panel };
  const [search, setSearch] = useState("");
  const [mapMenu, setMapMenu] = useState(false);
  const [, bump] = useState(0);

  const cssSize = (): Viewport => {
    const el = wrapRef.current;
    return { w: el?.clientWidth || 1, h: el?.clientHeight || 1 };
  };

  const clientToWorld = useCallback((clientX: number, clientY: number): Vec | null => {
    const el = wrapRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const v = cam.current;
    const scale = r.width / v.s;
    const svgX = v.x + (clientX - r.left) / scale;
    const svgY = v.y + (clientY - r.top) / scale;
    return {
      x: clamp(svgX, 0, MAP_SIZE_UNITS),
      y: clamp(MAP_SIZE_UNITS - svgY, 0, MAP_SIZE_UNITS),
    };
  }, []);

  const paintMini = () => {
    const c = miniRef.current;
    if (!c) return;
    if (cssSize().w < 768 || cssSize().h < 541) return;
    const size = 112;
    const dpr = canvasDpr(cssSize().w);
    if (c.width !== Math.floor(size * dpr)) {
      c.width = Math.floor(size * dpr);
      c.height = Math.floor(size * dpr);
      c.style.width = `${size}px`;
      c.style.height = `${size}px`;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = propsRef.current.map;
    ctx.clearRect(0, 0, size, size);
    const rec = getBaseMap(m);
    if (rec.status === "ok") ctx.drawImage(rec.img, 0, 0, size, size);
    else {
      const z0 = getTile(m, 0, 0, 0);
      if (z0.status === "ok") ctx.drawImage(z0.img, 0, 0, size, size);
    }
    const v = cam.current;
    const vp = cssSize();
    const visH = visHeight(v.s, vp);
    const k = size / MAP_SIZE_UNITS;
    ctx.strokeStyle = "rgb(244 241 228)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(v.x * k, v.y * k, v.s * k, visH * k);
    const g = propsRef.current.gun;
    const t = propsRef.current.target;
    const zc = propsRef.current.zoneCenter;
    if (zc) {
      const radius = zoneRadiusUnits(propsRef.current.zoneDiameterM) * k;
      ctx.fillStyle = "rgb(222 184 92 / 0.14)";
      ctx.strokeStyle = "rgb(222 184 92 / 0.95)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(zc.x * k, (MAP_SIZE_UNITS - zc.y) * k, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (g) {
      ctx.fillStyle = "#9ec0d4";
      ctx.beginPath();
      ctx.arc(g.x * k, (MAP_SIZE_UNITS - g.y) * k, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t) {
      ctx.fillStyle = "#e07060";
      ctx.fillRect(t.x * k - 2.5, (MAP_SIZE_UNITS - t.y) * k - 2.5, 5, 5);
    }
  };

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const {
      map: m,
      gun: g,
      target: t,
      zoneCenter: zc,
      zoneDiameterM: zd,
      zonePlacementId: zp,
      weapon: w,
      placeMode: mode,
      panel: pnl,
    } = propsRef.current;
    const { w: cssW, h: cssH } = cssSize();
    const dpr = canvasDpr(cssW);
    if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctxRef.current = null;
    }
    let ctx = ctxRef.current;
    if (!ctx || ctx.canvas !== canvas) {
      ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
      ctxRef.current = ctx;
    }
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = wrap.getBoundingClientRect();
    const cur =
      cssW >= 768 && pointer.current
        ? { x: pointer.current.x - r.left, y: pointer.current.y - r.top }
        : null;
    drawMap(ctx, cssW, cssH, cam.current, m, g, t, zc, zd, zp, w, mode, cur, pnl);
    paintMini();
    const v = cam.current;
    if (zoomEl.current) {
      const z = Number.isFinite(v.s) && v.s > 0 ? MAP_SIZE_UNITS / v.s : 1;
      zoomEl.current.textContent = `${z.toFixed(1)}×`;
    }
    const hv = hover.current;
    if (hoverEl.current) {
      hoverEl.current.textContent = hv
        ? `${formatXy(hv)}  ${gridRef(hv)}`
        : propsRef.current.panel === "haul"
          ? "滚轮缩放 · 拖动平移 · 点选出发/卸货"
          : "滚轮缩放 · 拖动平移 · Shift+点击炮位 · Alt+点击战区";
    }
  }, []);

  const schedulePaint = useCallback(() => {
    if (paintRaf.current) return;
    paintRaf.current = requestAnimationFrame(() => {
      paintRaf.current = 0;
      paint();
    });
  }, [paint]);

  const setCam = (next: Cam, syncHud = true, fromUser = true) => {
    if (fromUser) dirty.current = true;
    cam.current = clampCam(next, MAP_SIZE_UNITS, cssSize());
    schedulePaint();
    if (syncHud) bump((n) => n + 1);
  };

  const zoomAt = (cx: number, cy: number, factor: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (cx - r.left) / r.width;
    const py = (cy - r.top) / r.height;
    const v = cam.current;
    const visH = visHeight(v.s, { w: r.width, h: r.height });
    const s = v.s * factor;
    const visH2 = visHeight(s, { w: r.width, h: r.height });
    setCam({
      s,
      x: v.x + px * v.s - px * s,
      y: v.y + py * visH - py * visH2,
    });
  };
  zoomAtRef.current = zoomAt;

  const fitCurrent = () => {
    const p = propsRef.current;
    if (p.panel === "haul" && p.gun && p.target) {
      return fitHaulView(p.gun, p.target, MAP_SIZE_UNITS, cssSize());
    }
    return fitTowersView(p.map, MAP_SIZE_UNITS, cssSize());
  };

  const resetCam = () => {
    dirty.current = false;
    setCam(fitView(propsRef.current.map.bounds, MAP_SIZE_UNITS, cssSize()), false, false);
  };

  useEffect(() => {
    prefetchBase(map);
    dirty.current = false;
    setCam(fitCurrent(), false, false);
  }, [map]);

  useEffect(() => {
    if (panel !== "haul") return;
    dirty.current = false;
    setCam(fitCurrent(), false, false);
  }, [panel]);

  useEffect(() => {
    schedulePaint();
  }, [map, gun, target, zoneCenter, zoneDiameterM, zonePlacementId, weapon, placeMode, panel, schedulePaint]);

  useEffect(() => onTilesChange(schedulePaint), [schedulePaint]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!dirty.current) {
        cam.current = fitCurrent();
      } else {
        cam.current = clampCam(cam.current, MAP_SIZE_UNITS, cssSize());
      }
      schedulePaint();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (paintRaf.current) cancelAnimationFrame(paintRaf.current);
    };
  }, [schedulePaint]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      e.preventDefault();
      e.stopPropagation();
      zoomAtRef.current(e.clientX, e.clientY, wheelFactor(e, el.clientHeight));
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const v = cam.current;
      const vp = cssSize();
      const visH = visHeight(v.s, vp);
      const stepX = v.s * (e.shiftKey ? 0.22 : 0.12);
      const stepY = visH * (e.shiftKey ? 0.22 : 0.12);
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") setCam({ ...v, y: v.y - stepY });
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") setCam({ ...v, y: v.y + stepY });
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") setCam({ ...v, x: v.x - stepX });
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") setCam({ ...v, x: v.x + stepX });
      if (e.key === "=" || e.key === "+") {
        const el = wrapRef.current?.getBoundingClientRect();
        if (el) zoomAt(el.left + el.width / 2, el.top + el.height / 2, 1 / 1.6);
      }
      if (e.key === "-" || e.key === "_") {
        const el = wrapRef.current?.getBoundingClientRect();
        if (el) zoomAt(el.left + el.width / 2, el.top + el.height / 2, 1.6);
      }
      if (e.key === "0") resetCam();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    skipPlace.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.button === 2 || e.buttons === 2) {
      zoomDrag.current = {
        y: e.clientY,
        s: cam.current.s,
        cx: e.clientX,
        cy: e.clientY,
        vx: cam.current.x,
        vy: cam.current.y,
      };
      skipPlace.current = true;
      drag.current = null;
      return;
    }
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), moved: false };
      drag.current = null;
      return;
    }
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      vx: cam.current.x,
      vy: cam.current.y,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pointer.current = { x: e.clientX, y: e.clientY };
    const p = clientToWorld(e.clientX, e.clientY);
    hover.current = p;
    if (hoverEl.current && p) hoverEl.current.textContent = `${formatXy(p)}  ${gridRef(p)}`;

    if (zoomDrag.current && e.buttons & 2) {
      const z = zoomDrag.current;
      const el = wrapRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const px = (z.cx - r.left) / r.width;
        const py = (z.cy - r.top) / r.height;
        const vp = { w: r.width, h: r.height };
        const visH = visHeight(z.s, vp);
        const s = z.s * Math.exp((e.clientY - z.y) * 0.012);
        const visH2 = visHeight(s, vp);
        setCam({ s, x: z.vx + px * z.s - px * s, y: z.vy + py * visH - py * visH2 }, false);
      }
      skipPlace.current = true;
      return;
    }

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 8 && pinch.current.dist > 8) {
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.current.dist / dist);
        pinch.current = { dist, moved: true };
        skipPlace.current = true;
      }
      return;
    }

    const d = drag.current;
    if (!d || d.id !== e.pointerId) {
      schedulePaint();
      return;
    }
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 5) {
      d.moved = true;
      skipPlace.current = true;
    }
    if (!d.moved) {
      schedulePaint();
      return;
    }
    const scale = r.width / cam.current.s;
    setCam(
      {
        s: cam.current.s,
        x: d.vx - dx / scale,
        y: d.vy - dy / scale,
      },
      false,
    );
  };

  const onPointerUp = () => {
    pointers.current.clear();
    pinch.current = null;
    drag.current = null;
    zoomDrag.current = null;
  };

  const onClick = (e: React.MouseEvent) => {
    if (skipPlace.current) return;
    const p = clientToWorld(e.clientX, e.clientY);
    if (!p) return;
    if (clickTimer.current) window.clearTimeout(clickTimer.current);
    const modeOverride = e.altKey ? "zone" : e.shiftKey ? "gun" : undefined;
    const effectiveMode = modeOverride ?? propsRef.current.placeMode;
    const snapped = snapWorld(
      p,
      propsRef.current.map,
      cam.current.s,
      cssSize().w,
      effectiveMode,
      propsRef.current.panel,
      propsRef.current.zoneCenter,
    );
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      onPlace(snapped, modeOverride);
    }, 220);
  };

  const centerBtn = (factor: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  };

  const jumpSearch = () => {
    const p = parsePair(search);
    if (!p) return;
    setCam(focusView(p, 8, MAP_SIZE_UNITS, cssSize()));
    onPlace(p);
  };

  const spec = WEAPONS[weapon];
  const zoomNow = Number.isFinite(cam.current.s) && cam.current.s > 0 ? MAP_SIZE_UNITS / cam.current.s : 1;
  const towers = getTowerMarkers(map);
  const towersInZone = zoneCenter ? getTowersInControlZone(map, zoneCenter, zoneDiameterM) : [];
  const zonePlacement = getZonePlacement(mapId, zonePlacementId);
  const towersInZoneLabels = new Set(towersInZone.map((tower) => tower.label));
  const activeTower = target
    ? towers.find((tower) => distanceMeters(target, tower.pos) <= 1)
    : undefined;

  return (
    <div className="relative size-full min-h-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-end gap-2 p-2 map-chrome desk:p-3">
        <div className="pointer-events-auto relative flex items-center gap-1 rounded-lg hud-glass p-1 shadow-border desk:hidden">
          <button
            type="button"
            onClick={() => setMapMenu((v) => !v)}
            className="inline-flex h-11 items-center gap-1 rounded-md px-2.5 text-sm font-medium"
            aria-expanded={mapMenu}
            aria-haspopup="listbox"
          >
            {MAPS[mapId].name}
            <ChevronDown className={cn("size-4 text-muted transition-transform duration-(--motion-quick)", mapMenu && "rotate-180")} />
          </button>
          {mapMenu ? (
            <div className="absolute top-full right-0 z-30 mt-1 min-w-36 overflow-hidden rounded-lg hud-glass py-1 shadow-border" role="listbox">
              {(Object.keys(MAPS) as MapId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={mapId === id}
                  onClick={() => {
                    onMapId(id);
                    setMapMenu(false);
                  }}
                  className={cn("flex h-11 w-full items-center px-3 text-left text-sm", mapId === id ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10")}
                >
                  {MAPS[id].name}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className={cn("inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm", zoneCenter ? "text-zone" : "text-muted")}
            onClick={() => {
              if (!zoneCenter) return;
              setCam(fitView(controlZoneBounds(zoneCenter, zoneDiameterM), MAP_SIZE_UNITS, cssSize(), 3));
            }}
            title={zoneCenter ? `战区中心 ${formatXy(zoneCenter)}` : "战区未校准"}
          >
            <SquareDashed className="size-4" />
            {zoneCenter ? `${towersInZone.length}塔` : "战区"}
          </button>
        </div>
        <div className="pointer-events-auto hidden items-center gap-1 rounded-lg hud-glass p-1 shadow-border desk:flex">
          {(Object.keys(MAPS) as MapId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onMapId(id)}
              className={cn(
                "h-9 rounded-md px-2.5 text-xs font-medium",
                mapId === id ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10",
              )}
            >
              {MAPS[id].name}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto hidden items-center gap-1 rounded-lg hud-glass p-1 shadow-border desk:flex">
          <span className="px-1.5 text-xs font-medium tracking-wide text-muted">{panel === "haul" ? "卸货塔" : "精确塔位"}</span>
          {towers.map((tower) => {
            const short = tower.label.replace("塔 ", "T");
            const active = activeTower?.label === tower.label;
            const inZone = towersInZoneLabels.has(tower.label);
            return (
              <button
                key={tower.label}
                type="button"
                title={`${tower.label} · X ${tower.pos.x.toFixed(4)} · Y ${tower.pos.y.toFixed(4)}`}
                onClick={() => {
                  onPlace(tower.pos, "target");
                  setCam(focusView(tower.pos, 12, MAP_SIZE_UNITS, cssSize()));
                }}
                className={cn(
                  "inline-flex h-9 min-w-9 items-center gap-1 rounded-md px-2 font-mono text-xs tabular-nums",
                  active ? "bg-danger text-red-fg" : inZone ? "bg-zone/20 text-zone" : "text-fg hover:bg-fg/10",
                )}
              >
                <GameIcon name="tower" className="size-3.5" />
                {short}{inZone ? <span className="ml-1 text-xs">区</span> : null}
              </button>
            );
          })}
        </div>
        {panel === "haul" ? (
          <div className="pointer-events-auto hidden items-center gap-1 rounded-lg hud-glass p-1 shadow-border desk:flex">
            <span className="px-1.5 text-xs font-medium tracking-wide text-muted">我方</span>
            {getFobMarkers(map).map((mk) => {
              const faction = FACTIONS[mk.kind as FobId];
              const activeOrigin = gun && distanceMeters(gun, mk.pos) <= 80;
              return (
                <button
                  key={mk.kind}
                  type="button"
                  title={`${faction.nameZh} ${faction.nameEn} · 设为我方出生点`}
                  onClick={() => {
                    onPlace(mk.pos, "gun");
                    setCam(focusView(mk.pos, 14, MAP_SIZE_UNITS, cssSize()));
                  }}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-semibold",
                    activeOrigin ? faction.chipOn : faction.chipOff,
                  )}
                >
                  <GameIcon name={mk.kind} className="size-5" />
                  {faction.nameZh}
                </button>
              );
            })}
          </div>
        ) : null}
        <button
          type="button"
          className={cn(
            "pointer-events-auto hidden h-11 items-center gap-2 rounded-lg hud-glass px-3 text-xs shadow-border desk:inline-flex",
            zoneCenter ? "text-zone" : "text-muted",
          )}
          onClick={() => {
            if (!zoneCenter) return;
            setCam(fitView(controlZoneBounds(zoneCenter, zoneDiameterM), MAP_SIZE_UNITS, cssSize(), 3));
          }}
          title={zoneCenter ? `战区中心 ${formatXy(zoneCenter)} · 直径 ${(zoneDiameterM / 1000).toFixed(2)} km` : "当前战区未校准：选择战区模式后点击中心"}
        >
          <SquareDashed className="size-4" />
          <span>
            {zoneCenter
              ? `${zonePlacement ? `${zonePlacement.region}/${zonePlacement.label}` : "战区"} · ${towersInZone.length} 塔`
              : zonePlacement
                ? `${zonePlacement.region}/${zonePlacement.label} · 待校准中心`
                : "战区未校准"}
          </span>
        </button>
        <form
          className="pointer-events-auto hidden min-w-40 items-center gap-1 rounded-lg hud-glass px-2 py-1 shadow-border desk:flex"
          onSubmit={(e) => {
            e.preventDefault();
            jumpSearch();
          }}
        >
          <Search className="size-3.5 shrink-0 text-fg" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="跳转 80.12 81.40 / I8-23"
            className="h-8 border-0 bg-transparent shadow-none"
          />
        </form>
        <div className="pointer-events-auto hidden gap-1 rounded-lg hud-glass p-1 shadow-border desk:flex">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs text-fg hover:bg-fg/10 disabled:opacity-40"
            disabled={!gun}
            onClick={() => gun && setCam(focusView(gun, 10, MAP_SIZE_UNITS, cssSize()))}
          >
            <Locate className="size-3.5" />
            {panel === "haul" ? "出发" : "炮"}
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs text-fg hover:bg-fg/10 disabled:opacity-40"
            disabled={!target}
            onClick={() => target && setCam(focusView(target, 10, MAP_SIZE_UNITS, cssSize()))}
          >
            <Target className="size-3.5" />
            {panel === "haul" ? "卸货" : "目标"}
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs text-fg hover:bg-fg/10 disabled:opacity-40"
            disabled={!gun || !target}
            onClick={() => {
              if (!gun || !target) return;
              setCam(fitHaulView(gun, target, MAP_SIZE_UNITS, cssSize()));
            }}
          >
            <Crosshair className="size-3.5" />
            {panel === "haul" ? "航线" : "射击"}
          </button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md text-fg hover:bg-fg/10"
            onClick={() => centerBtn(1 / 1.7)}
            aria-label="放大"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md text-fg hover:bg-fg/10"
            onClick={resetCam}
            aria-label="复位全图"
          >
            <LocateFixed className="size-4" />
          </button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md text-fg hover:bg-fg/10"
            onClick={() => centerBtn(1.7)}
            aria-label="缩小"
          >
            <Minus className="size-4" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute z-20 flex flex-col gap-1 desk:hidden map-zoom">
        <div className="pointer-events-auto flex flex-col gap-1 rounded-lg hud-glass p-1 shadow-border">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md text-fg hover:bg-fg/10"
            onClick={() => centerBtn(1 / 1.7)}
            aria-label="放大"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md text-fg hover:bg-fg/10"
            onClick={resetCam}
            aria-label="复位全图"
          >
            <LocateFixed className="size-4" />
          </button>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md text-fg hover:bg-fg/10"
            onClick={() => centerBtn(1.7)}
            aria-label="缩小"
          >
            <Minus className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        tabIndex={0}
        className="absolute inset-0 cursor-crosshair touch-none overflow-hidden overscroll-none outline-none"
        style={{
          backgroundColor: "var(--color-earth)",
          backgroundImage: `url(/maps/${mapId}.webp)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        onWheel={(e) => {
          e.preventDefault();
          zoomAtRef.current(e.clientX, e.clientY, wheelFactor(e, e.currentTarget.clientHeight));
        }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerCancel={() => {
          drag.current = null;
          pinch.current = null;
          pointers.current.clear();
        }}
        onPointerLeave={() => {
          hover.current = null;
          pointer.current = null;
          schedulePaint();
        }}
        onDoubleClick={(e) => {
          if (clickTimer.current) {
            window.clearTimeout(clickTimer.current);
            clickTimer.current = null;
          }
          zoomAt(e.clientX, e.clientY, 0.45);
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 size-full bg-transparent" />
        <canvas
          ref={miniRef}
          className="mini-dock absolute z-10 hidden cursor-pointer rounded-sm shadow-border desk:right-3 desk:block"
          width={112}
          height={112}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            const nx = ((e.clientX - r.left) / r.width) * MAP_SIZE_UNITS;
            const ny = MAP_SIZE_UNITS - ((e.clientY - r.top) / r.height) * MAP_SIZE_UNITS;
            setCam(centerView({ x: nx, y: ny }, cam.current.s, MAP_SIZE_UNITS, cssSize()));
          }}
        />
        <div className="pointer-events-none absolute bottom-2 left-2 hidden font-mono text-xs text-fg desk:right-32 desk:left-3 desk:flex desk:items-end desk:justify-between desk:gap-2 mini-dock">
          <span className="rounded-sm bg-hud px-2 py-1 shadow-border">
            {panel === "haul"
              ? `${placeMode === "gun" ? "点选出发" : placeMode === "zone" ? "点选战区卸货" : "点选卸货"} · ${map.nameZh} · `
              : `${spec.shortName} · ${placeMode === "gun" ? "点选炮位" : placeMode === "zone" ? "校准战区中心" : "点选目标"} · ${map.nameZh} · `}
            <span ref={zoomEl}>{zoomNow.toFixed(1)}×</span>
          </span>
          <span ref={hoverEl} className="rounded-sm bg-hud px-2 py-1 tabular-nums shadow-border">
            滚轮缩放 · 拖动平移 · Shift+点击炮位 · Alt+点击战区
          </span>
        </div>
      </div>
    </div>
  );
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  view: Cam,
  map: (typeof MAPS)[MapId],
  gun: Vec | null,
  target: Vec | null,
  zoneCenter: Vec | null,
  zoneDiameterM: number,
  zonePlacementId: string | null,
  weapon: WeaponId,
  placeMode: "gun" | "target" | "zone",
  pointer: { x: number; y: number } | null,
  panel: "fire" | "haul" = "fire",
) {
  ctx.clearRect(0, 0, cssW, cssH);

  const scale = cssW / view.s;
  const visH = cssH / scale;
  const worldX = (sx: number) => (sx - view.x) * scale;
  const worldYsvg = (sy: number) => (sy - view.y) * scale;
  const wx = (p: Vec) => worldX(p.x);
  const wy = (p: Vec) => worldYsvg(MAP_SIZE_UNITS - p.y);

  const tb = map.tileBounds;
  const base = getBaseMap(map);
  if (base.status === "ok") {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = cssW < 640 ? "medium" : "high";
    ctx.drawImage(
      base.img,
      worldX(tb.minX),
      worldYsvg(MAP_SIZE_UNITS - tb.maxY),
      (tb.maxX - tb.minX) * scale,
      (tb.maxY - tb.minY) * scale,
    );
  }

  const z = pickTileZoom(view.s, cssW, map.maxZoom);
  const n = 2 ** z;
  const tw = (tb.maxX - tb.minX) / n;
  const th = (tb.maxY - tb.minY) / n;
  const worldX0 = view.x;
  const worldX1 = view.x + view.s;
  const worldYNorth = MAP_SIZE_UNITS - view.y;
  const worldYSouth = MAP_SIZE_UNITS - (view.y + visH);
  const tx0 = clamp(Math.floor((worldX0 - tb.minX) / tw), 0, n - 1);
  const tx1 = clamp(Math.floor((worldX1 - tb.minX) / tw), 0, n - 1);
  const ty0 = clamp(Math.floor((tb.maxY - worldYNorth) / th), 0, n - 1);
  const ty1 = clamp(Math.floor((tb.maxY - worldYSouth) / th), 0, n - 1);

  const tileScreen = tw * scale;
  ctx.imageSmoothingEnabled = Math.abs(tileScreen - TILE_PX) > 6;
  ctx.imageSmoothingQuality = cssW < 640 ? "medium" : "high";

  if (z > 0) getTile(map, 0, 0, 0);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const left = tb.minX + tx * tw;
      const top = tb.maxY - ty * th;
      const dx = worldX(left);
      const dy = worldYsvg(MAP_SIZE_UNITS - top);
      const dw = tw * scale + 0.6;
      const dh = th * scale + 0.6;
      const rec = getTile(map, z, tx, ty);
      if (rec.status === "ok") {
        ctx.drawImage(rec.img, dx, dy, dw, dh);
      } else {
        const anc = ancestorSource(map, z, tx, ty);
        if (anc) {
          ctx.drawImage(anc.rec.img, anc.sx, anc.sy, anc.ss, anc.ss, dx, dy, dw, dh);
        }
      }
    }
  }

  const show100 = view.s < 36 && cssW >= 768;
  const kmStep = cssW < 640 ? 2 : 1;
  ctx.lineWidth = 1;
  for (let km = 0; km <= 16; km += kmStep) {
    const x = worldX(km * 10);
    const y = worldYsvg(MAP_SIZE_UNITS - km * 10);
    ctx.strokeStyle = "rgb(255 255 255 / 0.38)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, cssH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cssW, y);
    ctx.stroke();
  }
  if (show100) {
    ctx.strokeStyle = "rgb(255 255 255 / 0.14)";
    const x0 = Math.floor(view.x);
    const y0 = Math.floor(MAP_SIZE_UNITS - view.y - visH);
    for (let i = x0; i <= view.x + view.s + 1; i++) {
      const x = worldX(i);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }
    for (let j = y0; j <= MAP_SIZE_UNITS - view.y + 1; j++) {
      const y = worldYsvg(MAP_SIZE_UNITS - j);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    }
  }

  for (const sp of map.spawns) {
    const faction = FACTIONS[sp.tone];
    ctx.beginPath();
    sp.points.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(wx(pt), wy(pt));
      else ctx.lineTo(wx(pt), wy(pt));
    });
    ctx.closePath();
    ctx.fillStyle = faction.fill;
    ctx.strokeStyle = faction.hex;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    if (view.s < 90 && cssW >= 640) {
      const cx = sp.points.reduce((s, p) => s + p.x, 0) / sp.points.length;
      const cy = sp.points.reduce((s, p) => s + p.y, 0) / sp.points.length;
      haloText(ctx, faction.nameZh, wx({ x: cx, y: cy }), wy({ x: cx, y: cy }), 12, faction.hex);
    }
  }

  if (zoneCenter) {
    const radiusPx = zoneRadiusUnits(zoneDiameterM) * scale;
    const zx = wx(zoneCenter);
    const zy = wy(zoneCenter);
    const placement = getZonePlacement(map.id, zonePlacementId);

    ctx.save();
    ctx.beginPath();
    ctx.arc(zx, zy, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(222 184 92 / 0.11)";
    ctx.fill();
    ctx.strokeStyle = "#deb85c";
    ctx.lineWidth = 2;
    ctx.setLineDash(placement?.status === "never-rolled" ? [8, 6] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "#deb85c";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(zx - 10, zy);
    ctx.lineTo(zx + 10, zy);
    ctx.moveTo(zx, zy - 10);
    ctx.lineTo(zx, zy + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(zx, zy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#deb85c";
    ctx.fill();

    const title = placement ? `${placement.region} / ${placement.label}` : "当前战区";
    const sizeText = `Ø ${(zoneDiameterM / 1000).toFixed(2)} km`;
    haloText(ctx, `${title} · ${sizeText}`, zx, zy - radiusPx - 13, 11, "#deb85c");
    ctx.restore();
  }

  const spec = WEAPONS[weapon];
  if (gun && panel !== "haul") {
    const rings = weapon === "l81" ? [200, 400, spec.maxRange] : [1000, 2000, spec.maxRange];
    ctx.setLineDash([]);
    rings.forEach((rm, i) => {
      ctx.beginPath();
      ctx.arc(wx(gun), wy(gun), (rm / METERS_PER_UNIT) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = i === rings.length - 1 ? "rgb(255 255 255 / 0.7)" : "rgb(255 255 255 / 0.35)";
      ctx.lineWidth = i === rings.length - 1 ? 1.6 : 1;
      ctx.stroke();
    });
  }

  if (gun && target) {
    const rangeM = distanceMeters(gun, target);
    const bearing = azimuthDeg(gun, target);
    const inRange = panel === "haul" ? true : rangeM >= spec.minRange && rangeM <= spec.maxRange;
    ctx.setLineDash([8, 5]);
    ctx.strokeStyle = inRange ? "#f4f1e4" : "#e07060";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx(gun), wy(gun));
    ctx.lineTo(wx(target), wy(target));
    ctx.stroke();
    ctx.setLineDash([]);

    const mx = (wx(gun) + wx(target)) / 2;
    const my = (wy(gun) + wy(target)) / 2;
    const label = panel === "haul"
      ? `${(rangeM / 1000).toFixed(1)} km · ${bearing.toFixed(1).padStart(5, "0")}°`
      : `${Math.round(rangeM)} m · ${bearing.toFixed(1).padStart(5, "0")}°`;
    ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgb(16 20 12 / 0.78)";
    ctx.fillRect(mx - tw / 2 - 7, my - 11, tw + 14, 22);
    ctx.strokeStyle = inRange ? "rgb(244 241 228 / 0.38)" : "rgb(224 112 96 / 0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - tw / 2 - 7, my - 11, tw + 14, 22);
    ctx.fillStyle = inRange ? "#f4f1e4" : "#e07060";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, mx, my + 0.5);
  }

  const towerZoneLabels = zoneCenter
    ? new Set(getTowersInControlZone(map, zoneCenter, zoneDiameterM).map((tower) => tower.label))
    : null;

  const towerPts = getTowerMarkers(map).map((mk) => ({
    mk,
    x: wx(mk.pos),
    y: wy(mk.pos),
  }));

  for (const mk of map.markers) {
    const x = wx(mk.pos);
    const y = wy(mk.pos);
    if (mk.kind === "tower") {
      const inZone = towerZoneLabels?.has(mk.label) ?? null;
      const rPx = Math.max(8, (TOWER_RADIUS_M / METERS_PER_UNIT) * scale);
      ctx.beginPath();
      ctx.arc(x, y, rPx, 0, Math.PI * 2);
      ctx.strokeStyle = inZone === true ? "rgb(222 184 92 / 0.9)" : "rgb(244 241 228 / 0.45)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = inZone === true ? "rgb(222 184 92 / 0.12)" : "rgb(244 241 228 / 0.06)";
      ctx.fill();
      drawTower(ctx, x, y, inZone);
    } else {
      const faction = FACTIONS[mk.kind as FobId];
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = faction.hex;
      ctx.fill();
      ctx.strokeStyle = "#f4f1e4";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    if (mk.kind === "tower") {
      if (view.s < 32) {
        haloText(ctx, `${mk.pos.x.toFixed(2)}, ${mk.pos.y.toFixed(2)}`, x, y + 18, 10);
      }
    } else if (view.s < 70) {
      const faction = FACTIONS[mk.kind as FobId];
      haloText(ctx, faction.nameZh, x, y - 16, 12, faction.hex);
    }
  }

  for (let i = 0; i < towerPts.length; i++) {
    const p = towerPts[i];
    let dx = 0;
    let dy = -26;
    for (let j = 0; j < towerPts.length; j++) {
      if (i === j) continue;
      if (Math.hypot(p.x - towerPts[j].x, p.y - towerPts[j].y) < 36) {
        dx = p.x >= towerPts[j].x ? 16 : -16;
        dy = p.y <= towerPts[j].y ? -28 : 18;
      }
    }
    haloText(ctx, p.mk.label.replace("塔 ", "T"), p.x + dx, p.y + dy, 11);
  }

  if (gun) {
    drawGun(ctx, wx(gun), wy(gun));
    haloText(ctx, panel === "haul" ? "出发" : "我炮", wx(gun) + 12, wy(gun) - 10, 12);
  }
  if (target) {
    drawTgt(ctx, wx(target), wy(target));
    haloText(ctx, panel === "haul" ? "卸货" : "目标", wx(target) + 12, wy(target) - 10, 12);
  }

  ctx.font = "12px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  for (let i = 0; i < 16; i++) {
    const km = i * 10 + 5;
    const x = worldX(km);
    const y = worldYsvg(MAP_SIZE_UNITS - km);
    if (x > 18 && x < cssW - 18) haloText(ctx, LETTERS[i], x, 36, 12);
    if (y > 40 && y < cssH - 80) {
      ctx.textAlign = "left";
      haloText(ctx, String(i + 1), 10, y + 4, 12);
      ctx.textAlign = "center";
    }
  }

  const metersVisible = view.s * METERS_PER_UNIT;
  const mPerPx = metersVisible / cssW;
  const targetM = 88 * mPerPx;
  const nice = NICE_SCALES.find((n) => n >= targetM) ?? 5000;
  const barW = nice / mPerPx;
  const barY = cssH - 108;
  ctx.strokeStyle = "#f4f1e4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, barY);
  ctx.lineTo(20 + barW, barY);
  ctx.moveTo(20, barY - 5);
  ctx.lineTo(20, barY + 5);
  ctx.moveTo(20 + barW, barY - 5);
  ctx.lineTo(20 + barW, barY + 5);
  ctx.stroke();
  ctx.textAlign = "center";
  haloText(ctx, nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, 20 + barW / 2, barY - 10, 11);

  if (pointer) {
    const { x, y } = pointer;
    ctx.strokeStyle = placeMode === "gun" ? "#9ec0d4" : placeMode === "zone" ? "#deb85c" : "#e07060";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y + 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function snapWorld(
  p: Vec,
  map: (typeof MAPS)[MapId],
  viewS: number,
  viewportWidth: number,
  mode: "gun" | "target" | "zone",
  panel: "fire" | "haul" = "fire",
  zoneCenter: Vec | null = null,
): Vec {
  if (panel !== "haul" && mode !== "target") return p;
  const pxPerUnit = Math.max(1, viewportWidth) / Math.max(0.001, viewS);
  const hitRadiusPx = panel === "haul" ? 14 : 10;
  let best = p;
  let bestPx = hitRadiusPx;
  const magnets =
    panel === "haul" && mode === "gun"
      ? getFobMarkers(map)
      : panel === "haul"
        ? [...getTowerMarkers(map), { pos: zoneCenter ?? towerCluster(map) }]
        : getTowerMarkers(map);
  for (const mk of magnets) {
    const dPx = Math.hypot(p.x - mk.pos.x, p.y - mk.pos.y) * pxPerUnit;
    if (dPx <= bestPx) {
      bestPx = dPx;
      best = mk.pos;
    }
  }
  return best;
}

function drawTower(ctx: CanvasRenderingContext2D, x: number, y: number, zoneState: boolean | null = null) {
  // The small center dot is the true coordinate anchor. The pictogram sits
  // above it so the tower graphic never hides the exact location.
  ctx.save();
  if (zoneState === false) ctx.globalAlpha = 0.36;
  ctx.strokeStyle = zoneState === true ? "#deb85c" : "#f4f1e4";
  ctx.fillStyle = "#1a1c16";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = zoneState === true ? "#deb85c" : "#f4f1e4";
  ctx.beginPath();
  ctx.arc(x, y, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y - 9);
  ctx.stroke();
  ctx.fillStyle = zoneState === true ? "#deb85c" : "#f4f1e4";
  ctx.strokeStyle = "#1a1c16";
  ctx.lineWidth = 1;
  ctx.fillRect(x - 4, y - 19, 8, 10);
  ctx.strokeRect(x - 4, y - 19, 8, 10);
  ctx.fillRect(x - 6, y - 22, 12, 4);
  ctx.strokeRect(x - 6, y - 22, 12, 4);
  ctx.restore();
}

function haloText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color = "#f4f1e4",
) {
  ctx.font = `${size}px "IBM Plex Sans", "PingFang SC", sans-serif`;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgb(20 22 16 / 0.7)";
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawGun(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fillStyle = "#9ec0d4";
  ctx.fill();
  ctx.strokeStyle = "#f4f1e4";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#f4f1e4";
  ctx.fill();
}

function drawTgt(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#e07060";
  ctx.strokeStyle = "#f4f1e4";
  ctx.lineWidth = 2;
  ctx.fillRect(-8, -8, 16, 16);
  ctx.strokeRect(-8, -8, 16, 16);
  ctx.restore();
}
