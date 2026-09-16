import { createFileRoute } from "@tanstack/react-router";
import { FdcApp } from "@/components/fdc-app";
import { HaulMapBar } from "@/components/haul-map-bar";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="relative h-full w-full">
      <FdcApp />
      <HaulMapBar />
    </div>
  );
}
