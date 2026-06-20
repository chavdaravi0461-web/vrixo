import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group relative inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-full px-5 py-3 text-sm font-semibold tracking-[0.01em] transition-[transform,box-shadow,background,border-color,color,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border border-white/10 bg-[linear-gradient(135deg,var(--accent)_0%,#ffffff_48%,var(--accent-secondary)_100%)] text-[var(--bg)] shadow-[var(--shadow-button)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-button-hover)]",
        secondary:
          "border border-white/10 bg-white/10 text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl hover:-translate-y-0.5 hover:bg-white/15 hover:shadow-[var(--shadow-soft)]",
        outline:
          "border border-[var(--border-strong)] bg-[rgba(255,255,255,.025)] text-[var(--text)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:shadow-[var(--shadow-soft)]",
        ghost: "text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text)]"
      },
      size: {
        sm: "min-h-9 px-4 py-2 text-xs",
        md: "px-5 py-3 text-sm",
        lg: "min-h-12 px-6 py-3.5 text-base"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  )
);

Button.displayName = "Button";
