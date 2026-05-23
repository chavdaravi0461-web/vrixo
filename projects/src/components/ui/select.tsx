import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-12 w-full rounded-none border border-[#d9cbb8] bg-white px-4 text-sm text-[#181510] shadow-sm outline-none transition focus:border-[#8a5a24] focus:ring-4 focus:ring-[var(--ring)]",
      className
    )}
    {...props}
  />
));

Select.displayName = "Select";
