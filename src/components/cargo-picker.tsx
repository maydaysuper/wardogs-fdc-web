import { Minus, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CargoGlyph } from "@/components/cargo-glyph";
import { GameIcon } from "@/components/game-icon";
import { VehicleGlyph } from "@/components/vehicle-glyph";
import {
  CARGO_ITEMS,
  CARGO_TABS,
  cargoLabel,
  getCargo,
  packForVehicle,
  summarizeCargo,
  type CargoTab,
  type PackedCargo,
} from "@/lib/haul/cargo";
import { getBed, getHaulVehicle, NAME_EN } from "@/lib/haul/catalog";
import { cn } from "@/lib/utils";

function money(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}

export function CargoPicker({
  vehicleId,
  cargoIds,
  onChange,
  onClose,
}: {
  vehicleId: string;
  cargoIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<CargoTab>("pallets");
  const vehicle = getHaulVehicle(vehicleId);
  const bed = getBed(vehicleId);
  const packed = packForVehicle(vehicleId, cargoIds);
  const summary = summarizeCargo(packed.placed);
  const items = CARGO_ITEMS.filter((item) => item.tab === tab);

  const add = (id: string) => {
    const next = packForVehicle(vehicleId, [...cargoIds, id]);
    onChange(next.placed);
  };
  const removeOne = (id: string) => {
    const idx = cargoIds.lastIndexOf(id);
    if (idx < 0) return;
    onChange(cargoIds.filter((_, i) => i !== idx));
  };
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const id of cargoIds) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, [cargoIds]);

  const bedHint = bed.palletSlots
    ? `货斗 ${bed.w}×${bed.h} · ${bed.palletSlots} 托盘`
    : bed.crateSlots
      ? `${bed.crateSlots} 货箱位`
      : bed.w
        ? `货斗 ${bed.w}×${bed.h}`
        : "无货斗";

  return createPortal(
    <div className="vendor-overlay" role="dialog" aria-modal aria-label="车库后勤">
      <div className="vendor-sheet flex w-full max-w-5xl flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-2 py-2">
          <div className="chip-scroll min-w-0 flex-1 desk:flex-wrap">
            <GameIcon name="garage_vendor" className="size-7" />
            <p className="hidden font-mono text-xs font-medium tracking-widest text-muted uppercase desk:block">Garage · Logistics</p>
            <div className="grid grid-cols-3 gap-1 rounded-sm bg-surface p-0.5">
              {CARGO_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "h-11 min-w-16 rounded-sm px-3 font-mono text-xs font-semibold tracking-widest desk:h-9 desk:px-4",
                    tab === t.id ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10",
                  )}
                >
                  {t.en}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm hover:bg-fg/10" onClick={onClose} aria-label="关闭">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col desk:grid desk:grid-cols-[1fr_18rem]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            <div className="mb-3 flex items-center gap-2 text-xs text-subtle">
              <VehicleGlyph id={vehicleId} className="h-12 w-24 shrink-0" />
              <span className="min-w-0 truncate">
                {NAME_EN[vehicleId]} · {vehicle.nameZh}
                <span className="mx-1">·</span>
                {bedHint}
              </span>
            </div>
            <div className="mb-3 hidden desk:block">
              <BedGrid packed={packed} vehicleId={vehicleId} />
            </div>
            <ul className="grid grid-cols-1 gap-2 desk:grid-cols-2">
              {items.map((item) => {
                const n = counts.get(item.id) ?? 0;
                const trial = packForVehicle(vehicleId, [...cargoIds, item.id]);
                const canAdd = item.slot === "kit" || trial.placed.filter((id) => id === item.id).length > n;
                return (
                  <li key={item.id}>
                    <div className={cn("flex h-full items-stretch gap-2 rounded-sm bg-surface p-2 shadow-border", n > 0 ? "bg-surface-2" : "")}>
                      <button
                        type="button"
                        onClick={() => add(item.id)}
                        disabled={!canAdd}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-40"
                      >
                        <span className="vendor-slot relative inline-flex size-20 shrink-0 items-center justify-center rounded-sm bg-bg desk:size-24">
                          <CargoGlyph item={item} className="h-[88%] w-[88%]" />
                          {n > 0 ? (
                            <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-xs text-accent-fg">
                              {n}
                            </span>
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-xs tracking-wide text-muted uppercase">{item.nameEn}</span>
                          <span className="block truncate text-sm font-medium">{item.nameZh}</span>
                          <span className="block truncate text-xs text-subtle">
                            {item.units ? `${item.units} SUPPLY` : item.slot === "bed" ? `${item.w}×${item.h}` : "KIT"}
                            <span className="mx-1">·</span>
                            {item.note}
                          </span>
                        </span>
                        <span className="shrink-0 self-start font-mono text-sm tabular-nums text-ok">{money(item.buy)}</span>
                      </button>
                      <span className="flex flex-col justify-center gap-1">
                        <button
                          type="button"
                          className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-fg/10 disabled:opacity-40 desk:size-9"
                          onClick={() => add(item.id)}
                          disabled={!canAdd}
                          aria-label={`增加${item.nameZh}`}
                        >
                          <Plus className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-fg/10 disabled:opacity-40 desk:size-9"
                          onClick={() => removeOne(item.id)}
                          disabled={n <= 0}
                          aria-label={`减少${item.nameZh}`}
                        >
                          <Minus className="size-3.5" />
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <aside className="shrink-0 border-t border-line bg-surface px-3 py-3 desk:border-t-0">
            <p className="font-mono text-xs font-medium tracking-widest text-muted uppercase">Loadout</p>
            <p className="mt-1 truncate text-sm">{cargoLabel(packed.placed)}</p>
            <p className="mt-2 font-mono text-2xl tabular-nums text-ok desk:text-3xl">{money(summary.palletCost + summary.extraCost)}</p>
            <p className="text-xs text-subtle">本趟买价 · 投放另算</p>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle">
              <li>托盘 {summary.pallets} · {money(summary.palletCost)}</li>
              {summary.crates ? <li>货箱 {summary.crates} · 无投放奖</li> : null}
              {summary.extraCost ? <li>物品 / 货箱 {money(summary.extraCost)}</li> : null}
              {summary.units ? <li>入库补给 {summary.units.toLocaleString("en-US")}</li> : null}
            </ul>
            <p className="mt-2 hidden text-xs leading-snug text-subtle desk:block">
              托盘买 $400，投放 $2,500，FOB 卸进库 +$1,800。货箱是卖给队友的，账本不算投放。
            </p>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BedGrid({ vehicleId, packed }: { vehicleId: string; packed: PackedCargo }) {
  const bed = getBed(vehicleId);
  if (bed.crateSlots > 0) {
    return (
      <div className="grid grid-cols-2 gap-1">
        {Array.from({ length: bed.crateSlots }, (_, i) => {
          const slot = packed.placements[i];
          const item = slot ? getCargo(slot.id) : null;
          return (
            <div key={i} className={cn("flex h-16 items-center justify-center gap-2 rounded-sm text-xs", item ? "bg-surface-2 text-fg" : "bg-surface text-subtle")}>
              {item ? (
                <>
                  <CargoGlyph item={item} className="h-10 w-12" />
                  {item.nameZh}
                </>
              ) : (
                "空位"
              )}
            </div>
          );
        })}
      </div>
    );
  }
  if (bed.w <= 0 || bed.h <= 0) {
    return <p className="rounded-sm bg-surface px-3 py-4 text-sm text-subtle">这辆车没有后勤货斗，只能载人。</p>;
  }
  return (
    <div className="overflow-x-auto">
      <div className="relative min-w-xs">
        <div
          className="grid gap-px rounded-sm bg-line p-px"
          style={{ gridTemplateColumns: `repeat(${bed.w}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${bed.h}, 2.5rem)` }}
        >
          {Array.from({ length: bed.w * bed.h }, (_, i) => (
            <div key={i} className="h-10 bg-surface" />
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-px grid gap-px"
          style={{ gridTemplateColumns: `repeat(${bed.w}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${bed.h}, 2.5rem)` }}
        >
          {packed.placements.map((slot, i) => {
            const item = getCargo(slot.id);
            return (
              <div
                key={`${slot.id}-${i}`}
                className="flex items-center justify-center overflow-hidden bg-surface-2 px-1"
                style={{ gridColumn: `${slot.x + 1} / span ${slot.w}`, gridRow: `${slot.y + 1} / span ${slot.h}` }}
                title={item?.nameZh}
              >
                {item ? <CargoGlyph item={item} className="h-8 w-12" /> : null}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-1 text-xs text-subtle">
        格子 {bed.w}×{bed.h} · 托盘 4×2 · 大箱 4×1 · 小箱 3×1
      </p>
    </div>
  );
}
