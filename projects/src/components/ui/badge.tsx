import { cn } from "@/lib/utils";

export function Badge({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border border-[var(--border)] bg-[rgba(255,255,255,.06)] text-[var(--text-secondary)]",
        className
      )}
    >
      {children}
    </span>
  );
}
