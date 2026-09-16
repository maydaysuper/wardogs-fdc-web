import { cn } from "@/lib/utils";

export function VehicleGlyph({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  return (
    <img
      src={`/game/vehicles/${id}.webp`}
      alt=""
      draggable={false}
      className={cn("pointer-events-none object-contain object-center", className)}
    />
  );
}
