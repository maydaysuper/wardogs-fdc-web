import { assetUrl } from "@/lib/asset";
import { cn } from "@/lib/utils";
import type { CargoItem } from "@/lib/haul/cargo";

export function CargoGlyph({ item, className }: { item: CargoItem; className?: string }) {
  return (
    <img
      src={assetUrl(`game/cargo/${item.id}.webp`)}
      alt=""
      draggable={false}
      className={cn("pointer-events-none object-contain object-center [image-rendering:auto]", className)}
    />
  );
}
