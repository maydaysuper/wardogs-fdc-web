import { assetUrl } from "@/lib/asset";
import { cn } from "@/lib/utils";

export function GameIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <img
      src={assetUrl(`game/${name}.webp`)}
      alt=""
      draggable={false}
      className={cn("pixel-icon pointer-events-none object-contain", className)}
    />
  );
}
