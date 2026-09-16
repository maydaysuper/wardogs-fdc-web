import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { FdcApp } from "@/components/fdc-app";
import { HaulMapBar } from "@/components/haul-map-bar";
import { useFdc } from "@/lib/fire/store";
import "./styles.css";

function HaulMapOverlay() {
  const panel = useFdc((s) => s.panel);
  if (panel !== "haul") return null;
  return (
    <>
      <div className="pointer-events-none absolute z-40 safe-hud-t left-[11.5rem] desk:left-[16.5rem]">
        <div className="pointer-events-auto rounded-lg hud-glass p-1 shadow-border">
          <HaulMapBar variant="header" />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 safe-hud-b">
        <div className="pointer-events-auto mx-auto mb-[min(46vh,24rem)] w-fit max-w-6xl rounded-lg hud-glass p-1 shadow-border">
          <HaulMapBar />
        </div>
      </div>
    </>
  );
}

function Home() {
  return (
    <div className="relative h-full w-full">
      <FdcApp />
      <HaulMapOverlay />
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <div className="relative h-dvh w-dvw overflow-hidden bg-[#0b0c0a] text-zinc-100">
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
  basepath: import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
