import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md bg-surface-2 px-3 font-mono text-sm text-fg tabular-nums shadow-border",
        "placeholder:text-subtle",
        "transition-[box-shadow] duration-(--motion-quick)",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
        "disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
