import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[rgba(255,255,255,.035)] px-4 text-sm text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] outline-none transition-[border-color,background,box-shadow,color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:bg-[rgba(255,255,255,.055)] focus:ring-4 focus:ring-[var(--accent-ring)]",
      className
    )}
    {...props}
  />
));

Select.displayName = "Select";
