import { cn } from "@/lib/utils";
import type { CargoItem } from "@/lib/haul/cargo";

export function CargoGlyph({ item, className }: { item: CargoItem; className?: string }) {
  return (
    <img
      src={`/game/cargo/${item.id}.webp`}
      alt=""
      draggable={false}
      className={cn("pointer-events-none object-contain object-center", className)}
    />
  );
}
