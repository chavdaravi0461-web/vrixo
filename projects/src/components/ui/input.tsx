import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-none border border-[var(--dc-border)] bg-white px-4 text-sm text-[var(--dc-text)] shadow-sm outline-none transition placeholder:text-[var(--dc-muted)] focus:border-[var(--dc-gold)] focus:ring-4 focus:ring-[var(--ring)]",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
