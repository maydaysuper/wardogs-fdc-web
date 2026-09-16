import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { VehicleGlyph } from "@/components/vehicle-glyph";
import { GameIcon } from "@/components/game-icon";
import {
  AIR_FILTERS,
  LAND_FILTERS,
  NAME_EN,
  VENDOR_ROWS,
  VENDOR_TABS,
  classLabel,
  getBed,
  getHaulVehicle,
  matchesVendor,
  vendorTabOf,
  type VendorFilter,
  type VendorTab,
} from "@/lib/haul/catalog";
import { cn } from "@/lib/utils";

function money(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}

export function VehiclePicker({
  selectedId,
  onSelect,
  onClose,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<VendorTab>(vendorTabOf(selectedId));
  const [filter, setFilter] = useState<VendorFilter>("all");
  const filters = tab === "land" ? LAND_FILTERS : AIR_FILTERS;
  const items = useMemo(
    () => VENDOR_ROWS.filter((row) => matchesVendor(row, tab, filter)).sort((a, b) => a.price - b.price),
    [tab, filter],
  );
  const selected = getHaulVehicle(selectedId);

  return createPortal(
    <div className="vendor-overlay" role="dialog" aria-modal aria-label="载具商店">
      <div className="vendor-sheet flex w-full max-w-6xl flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-2 py-2">
          <div className="chip-scroll min-w-0 flex-1 desk:flex-wrap">
          <GameIcon name="vendor" className="size-7" />
          <p className="hidden font-mono text-xs font-medium tracking-widest text-muted uppercase desk:block">Vehicle Vendor</p>
          <div className="grid grid-cols-2 gap-1 rounded-sm bg-surface p-0.5">
            {VENDOR_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setFilter("all");
                }}
                className={cn(
                  "h-9 min-w-20 rounded-sm px-4 font-mono text-xs font-semibold tracking-widest",
                  tab === t.id ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10",
                )}
              >
                {t.en}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "h-9 rounded-sm px-3 font-mono text-xs font-medium tracking-widest",
                  filter === f.id ? "bg-surface-2 text-fg shadow-border" : "text-muted hover:bg-fg/10 hover:text-fg",
                )}
              >
                {f.en}
              </button>
            ))}
          </div>
          </div>
          <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm hover:bg-fg/10" onClick={onClose} aria-label="关闭">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((row) => {
              const vehicle = getHaulVehicle(row.id);
              const bed = getBed(row.id);
              const on = row.id === selectedId;
              const klass = classLabel(row);
              const cargo = bed.palletSlots ? `${bed.palletSlots} PALLETS` : bed.crateSlots ? `${bed.crateSlots} CRATES` : bed.w ? `${bed.w}×${bed.h} BED` : "NO BED";
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(row.id);
                      onClose();
                    }}
                    className={cn(
                      "flex h-full w-full flex-col rounded-sm bg-surface p-3 text-left shadow-border transition-[opacity,transform,box-shadow] duration-(--motion-quick) ease-(--ease-out) hover:shadow-border-hover",
                      on ? "bg-surface-2" : "",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 font-mono text-xs tracking-wide text-subtle">{klass.en.toUpperCase()}</span>
                      <span className="shrink-0 font-mono text-sm font-medium tabular-nums text-ok">{money(row.price)}</span>
                    </span>
                    <span className="vendor-slot my-1 flex h-28 w-full items-center justify-center desk:h-40">
                      <VehicleGlyph id={row.id} className="max-h-full w-full" />
                    </span>
                    <span className="truncate font-mono text-sm font-semibold tracking-wide">{NAME_EN[row.id] ?? row.id}</span>
                    <span className="truncate text-xs text-subtle">{row.nameZh}</span>
                    <span className="mt-1 truncate font-mono text-xs tabular-nums text-muted">
                      {row.passengers} SEATS · {row.speedKmh} KM/H · {cargo}
                    </span>
                    {row.unlockPrice ? (
                      <span className="mt-2 rounded-sm bg-zone/20 px-1.5 py-1 font-mono text-xs text-zone">
                        UNLOCK {money(row.unlockPrice)} · {row.unlockNote}
                      </span>
                    ) : (
                      <span className="mt-2 font-mono text-xs text-muted">{row.unlockNote}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-3 py-2">
          <VehicleGlyph id={selectedId} className="h-12 w-24 shrink-0 desk:h-14 desk:w-28" />
          <p className="min-w-0 text-xs text-subtle">
            <span className="font-mono tracking-wide text-fg">{NAME_EN[selectedId]}</span>
            <span className="mx-2">·</span>
            {selected.nameZh}
            <span className="mx-2">·</span>
            重生价 {money(selected.price)}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
