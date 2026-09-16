import { MAP_IDS, MAPS } from "@/lib/fire/maps";
import { useFdc } from "@/lib/fire/store";
import { cn } from "@/lib/utils";

/** Transport-panel map switcher. Reads the FDC store so it can mount outside HaulHud. */
export function HaulMapBar() {
  const panel = useFdc((s) => s.panel);
  const mapId = useFdc((s) => s.mapId);
  const setMapId = useFdc((s) => s.setMapId);
  if (panel !== "haul") return null;
  return (
    <div className="pointer-events-none absolute z-40 safe-hud-t left-auto right-0">
      <div
        className="pointer-events-auto mx-2 mt-14 flex items-center gap-1 rounded-lg hud-glass p-1 shadow-border desk:mx-3 desk:mt-0"
        role="listbox"
        aria-label="选择地图"
      >
        {MAP_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={mapId === id}
            title={MAPS[id].name}
            onClick={() => setMapId(id)}
            className={cn(
              "inline-flex h-11 min-w-16 items-center justify-center rounded-md px-3 text-sm font-semibold desk:h-9 desk:min-w-14 desk:px-2.5 desk:text-xs",
              mapId === id ? "bg-accent text-accent-fg" : "text-fg hover:bg-fg/10",
            )}
          >
            {MAPS[id].nameZh}
          </button>
        ))}
      </div>
    </div>
  );
}
