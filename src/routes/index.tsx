import { createFileRoute } from "@tanstack/react-router";
import { FdcApp } from "@/components/fdc-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FdcApp />;
}
