
"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  WifiOff,
  RefreshCw,
  X,
} from "lucide-react";
import { ConnectionState } from "@/hooks/useYjsRoom";
import { cn } from "@/lib/utils";

interface RenderServerBannerProps {
  connectionState: ConnectionState;
  isServerWaking: boolean;
  connectDuration: number;
  reconnect: () => void;
  className?: string;
}

export function RenderServerBanner({
  connectionState,
  isServerWaking,
  connectDuration,
  reconnect,
  className,
}: RenderServerBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (connectionState === "connected") {
      setShowSuccess(true);

      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 2000);

      return () => clearTimeout(timer);
    }

    setShowSuccess(false);
    setIsDismissed(false);
  }, [connectionState]);

  if (isDismissed || connectionState === "unauthorized") {
    return null;
  }

  // Connected
  if (showSuccess) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "bg-surface/90 border border-default",
          "text-xs text-secondary animate-in fade-in duration-200",
          className
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        <span>Connected. Real-time sync active.</span>
      </div>
    );
  }

  // Server waking up
  if (isServerWaking) {
    const progress = Math.min(
      Math.round((connectDuration / 50) * 100),
      95
    );

    return (
      <div
        className={cn(
          "w-full max-w-sm mx-auto p-3 rounded-xl",
          "bg-surface border border-default shadow-lg",
          "text-primary space-y-3",
          "animate-in fade-in duration-200",
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-secondary" />

            <span className="text-xs font-medium">
              Connecting to server...
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss banner"
            className="text-muted hover:text-primary transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Minimal monochrome progress bar */}
        <div className="h-1 w-full rounded-full bg-subtle overflow-hidden">
          <div
            className="h-full rounded-full bg-secondary transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(progress, 5)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>Server is starting up. Please wait.</span>
          <span className="font-mono tabular-nums">
            {connectDuration}s
          </span>
        </div>
      </div>
    );
  }

  // Initial connection
  if (connectionState === "connecting") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "bg-surface/90 border border-default",
          "text-xs text-secondary",
          className
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }

  // Disconnected
  if (connectionState === "disconnected") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "bg-surface border border-default",
          "text-xs text-secondary",
          className
        )}
      >
        <WifiOff className="h-3.5 w-3.5 text-rose-500" />

        <span>Connection lost</span>

        <button
          type="button"
          onClick={reconnect}
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-70 transition-opacity"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  return null;
}
