import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-28 w-full rounded-none border border-[var(--dc-border)] bg-[var(--dc-surface)] px-4 py-3 text-sm text-[var(--dc-text)] shadow-sm outline-none transition placeholder:text-[var(--dc-muted)] focus:border-white focus:ring-4 focus:ring-white/20",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
