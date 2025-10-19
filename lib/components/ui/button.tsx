"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm font-base ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer border-2 border-border active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-main text-main-foreground shadow-shadow hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-shadow-hover",
        destructive:
          "bg-destructive text-destructive-foreground shadow-shadow hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-shadow-hover",
        accent:
          "bg-accent text-accent-foreground shadow-shadow hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-shadow-hover",
        outline:
          "border-border bg-background hover:bg-accent hover:text-accent-foreground shadow-shadow hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-shadow-hover",
        secondary:
          "bg-secondary-background text-secondary-foreground shadow-shadow hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-shadow-hover",
        ghost: "hover:bg-accent hover:text-accent-foreground border-transparent shadow-none",
        link: "text-foreground underline-offset-4 hover:underline border-transparent shadow-none",
        noShadow: "bg-main text-main-foreground border-border",
        reverse:
          "bg-main text-main-foreground shadow-shadow hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-shadow",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-base px-3",
        lg: "h-11 rounded-base px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };