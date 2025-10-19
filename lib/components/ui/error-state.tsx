"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  icon?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export function ErrorState({
  title = "⚠️ SOMETHING WENT WRONG",
  message = "An unexpected error occurred. Please try again.",
  icon = "❌",
  actionLabel = "🔄 TRY AGAIN",
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryAction,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("text-center space-y-6", className)}>
      <div className="text-6xl animate-shake">{icon}</div>
      <h1 className="text-4xl font-heading tracking-tight">{title}</h1>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{message}</p>
      <div className="flex gap-4 justify-center flex-wrap">
        {actionLabel && (
          <>
            {actionHref ? (
              <Button asChild size="lg">
                <Link href={actionHref}>{actionLabel}</Link>
              </Button>
            ) : onAction ? (
              <Button onClick={onAction} size="lg">
                {actionLabel}
              </Button>
            ) : null}
          </>
        )}
        {secondaryActionLabel && (
          <>
            {secondaryActionHref ? (
              <Button asChild variant="outline" size="lg">
                <Link href={secondaryActionHref}>{secondaryActionLabel}</Link>
              </Button>
            ) : onSecondaryAction ? (
              <Button onClick={onSecondaryAction} variant="outline" size="lg">
                {secondaryActionLabel}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

interface InlineErrorProps {
  message: string;
  onDismiss?: () => void;
  variant?: "error" | "warning" | "info";
}

export function InlineError({ message, onDismiss, variant = "error" }: InlineErrorProps) {
  const variants = {
    error: "border-destructive bg-destructive/10 text-destructive",
    warning: "border-yellow-500 bg-yellow-50/70 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200",
    info: "border-accent bg-accent/10 text-accent-foreground",
  };

  const icons = {
    error: "⚠️",
    warning: "⚡",
    info: "ℹ️",
  };

  return (
    <Card className={cn("border-2", variants[variant])}>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icons[variant]}</span>
          <p className="font-base text-sm">{message}</p>
        </div>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="ml-4">
            ✕
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorState
          title="⚠️ UNEXPECTED ERROR"
          message={this.state.error?.message || "Something went wrong with this component."}
          actionLabel="🔄 RELOAD PAGE"
          onAction={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}
