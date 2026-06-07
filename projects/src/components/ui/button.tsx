import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-none px-5 py-3 text-sm font-black uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--dc-bg-deep)] text-white hover:bg-[var(--dc-surface-hover)] focus:outline-none focus:ring-4 focus:ring-[var(--dc-gold)]",
        secondary:
          "bg-white text-black hover:bg-[var(--dc-gold-dark)] focus:outline-none focus:ring-4 focus:ring-white/30",
        outline:
          "border border-[var(--dc-border-strong)] bg-[var(--dc-surface)] text-[var(--dc-text)] hover:border-[var(--dc-gold)] hover:bg-[var(--dc-surface-hover)]",
        ghost: "text-[var(--dc-text)] hover:bg-[var(--dc-surface)]"
      },
      size: {
        sm: "px-4 py-2 text-xs",
        md: "px-5 py-3 text-sm",
        lg: "px-6 py-3.5 text-base"
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
