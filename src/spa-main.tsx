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
import "./styles.css";

function Home() {
  return (
    <div className="relative h-full w-full">
      <FdcApp />
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
