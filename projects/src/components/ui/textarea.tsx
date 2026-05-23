import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-28 w-full rounded-none border border-[var(--dc-border)] bg-white px-4 py-3 text-sm text-[var(--dc-text)] shadow-sm outline-none transition placeholder:text-[var(--dc-muted)] focus:border-[var(--dc-gold)] focus:ring-4 focus:ring-[var(--ring)]",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
