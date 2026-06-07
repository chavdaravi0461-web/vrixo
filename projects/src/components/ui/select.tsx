import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-12 w-full rounded-none border border-[var(--dc-border)] bg-[var(--dc-surface)] px-4 text-sm text-[var(--dc-text)] shadow-sm outline-none transition focus:border-white focus:ring-4 focus:ring-white/20",
      className
    )}
    {...props}
  />
));

Select.displayName = "Select";
