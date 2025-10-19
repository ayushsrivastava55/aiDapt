"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  onSecondaryAction?: () => void;
  className?: string;
  variant?: "default" | "card";
}

export function EmptyState({
  title = "📭 NO DATA FOUND",
  description = "There's nothing to display here yet.",
  icon = "🔍",
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryAction,
  className,
  variant = "default",
}: EmptyStateProps) {
  const content = (
    <>
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-2xl font-heading mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6">{description}</p>
      {(actionLabel || secondaryActionLabel) && (
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
      )}
    </>
  );

  if (variant === "card") {
    return (
      <Card className={cn("max-w-2xl mx-auto", className)}>
        <CardContent className="p-12 text-center">{content}</CardContent>
      </Card>
    );
  }

  return <div className={cn("text-center space-y-4 py-12", className)}>{content}</div>;
}

interface EmptyListProps {
  items: any[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  onEmptyAction?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function EmptyList({
  items,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyActionLabel,
  emptyActionHref,
  onEmptyAction,
  children,
  className,
}: EmptyListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        actionLabel={emptyActionLabel}
        actionHref={emptyActionHref}
        onAction={onEmptyAction}
        variant="card"
        className={className}
      />
    );
  }

  return <>{children}</>;
}
