"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-base px-2.5 py-0.5 text-xs font-heading transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-2 border-border",
  {
    variants: {
      variant: {
        default:
          "bg-main text-main-foreground shadow-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-shadow-hover",
        secondary:
          "bg-secondary-background text-secondary-foreground shadow-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-shadow-hover",
        destructive:
          "bg-destructive text-destructive-foreground shadow-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-shadow-hover",
        outline: "text-foreground border-border bg-background shadow-shadow",
        accent:
          "bg-accent text-accent-foreground shadow-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-shadow-hover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };