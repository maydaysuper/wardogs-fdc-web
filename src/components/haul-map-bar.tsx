import { MAP_IDS, MAPS } from "@/lib/fire/maps";
import { useFdc } from "@/lib/fire/store";
import { cn } from "@/lib/utils";

export function HaulMapBar({ variant = "hud" }: { variant?: "header" | "hud" }) {
  const mapId = useFdc((s) => s.mapId);
  const setMapId = useFdc((s) => s.setMapId);
  return (
    <div
      className={cn("chip-scroll", variant === "hud" && "desk:flex-wrap")}
      role="listbox"
      aria-label="选择地图"
    >
      {variant === "hud" ? <span className="hidden px-1 text-xs font-medium tracking-wide text-muted desk:inline">地图</span> : null}
      {MAP_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="option"
          aria-selected={mapId === id}
          title={`${MAPS[id].nameZh} ${MAPS[id].name}`}
          onClick={() => setMapId(id)}
          className={cn(
            "inline-flex items-center justify-center rounded-md font-semibold",
            variant === "header"
              ? "h-8 min-w-14 px-2.5 text-xs"
              : "h-11 min-w-16 px-3 text-sm desk:h-9 desk:min-w-14 desk:px-2.5 desk:text-xs",
            mapId === id ? "bg-accent text-accent-fg" : "bg-hud-2 text-fg hover:bg-fg/10",
          )}
        >
          {MAPS[id].nameZh}
        </button>
      ))}
    </div>
  );
}
