"use client";

import * as React from "react";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ size = "md", className, ...props }: LoadingSpinnerProps) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div
      className={cn("inline-block animate-spin rounded-full border-border border-t-accent", sizes[size], className)}
      role="status"
      aria-label="Loading"
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

interface LoadingPageProps {
  title?: string;
  description?: string;
  icon?: string;
}

export function LoadingPage({ title = "LOADING", description = "Please wait...", icon = "⏳" }: LoadingPageProps) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="text-6xl animate-bounce-in">{icon}</div>
        <h1 className="text-4xl font-heading tracking-tight">{title}</h1>
        <p className="text-lg text-muted-foreground">{description}</p>
        <LoadingSpinner size="lg" className="mx-auto" />
      </div>
    </div>
  );
}

interface LoadingCardsProps {
  count?: number;
  cols?: 1 | 2 | 3 | 4;
}

export function LoadingCards({ count = 4, cols = 4 }: LoadingCardsProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-6", gridCols[cols])}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6 space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
            <div className="h-3 bg-muted rounded w-full"></div>
            <div className="h-3 bg-muted rounded w-2/3"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
}

export function LoadingOverlay({ isLoading, children, message = "Loading..." }: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50 rounded-base">
          <div className="text-center space-y-4">
            <LoadingSpinner size="lg" />
            <p className="text-sm font-heading">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
