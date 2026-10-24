"use client";

import { useState, useEffect } from "react";
import { Loader2, Server, CheckCircle2, WifiOff, X, RefreshCw } from "lucide-react";
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
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // When successfully connected after a wake-up, show a brief success indicator then fade out
  useEffect(() => {
    if (connectionState === "connected") {
      setShowSuccessToast(true);
      const timer = setTimeout(() => {
        setShowSuccessToast(false);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setShowSuccessToast(false);
      setIsDismissed(false);
    }
  }, [connectionState]);

  // Don't render if dismissed or unauthorized
  if (isDismissed || connectionState === "unauthorized") {
    return null;
  }

  // Success state (brief 2.5s display when connection is first established)
  if (showSuccessToast) {
    return (
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface/95 border border-emerald-500/30 text-emerald-300 text-xs shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300",
          className
        )}
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        <span className="font-medium">Real-time server connected. Instant sync active!</span>
      </div>
    );
  }

  // Waking up state (triggers after ~3s of connecting/reconnecting)
  if (isServerWaking) {
    const estimatedProgress = Math.min(Math.round((connectDuration / 45) * 100), 95);

    return (
      <div
        className={cn(
          "pointer-events-auto max-w-md w-full mx-auto p-3.5 rounded-2xl bg-surface/95 border border-amber-500/30 shadow-2xl backdrop-blur-md text-primary animate-in fade-in slide-in-from-top-3 duration-300 space-y-2.5",
          className
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Server className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-primary">
                  Waking up real-time server
                </h4>
                <span className="text-[10px] px-1.5 py-0.5 font-medium rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Render Free Tier
                </span>
              </div>
              <p className="text-[11px] text-muted leading-tight mt-0.5">
                Free instances sleep when idle. Starting up usually takes ~50–60s.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss banner"
            className="text-muted hover:text-primary transition-colors p-1 rounded-md hover:bg-subtle/50 shrink-0 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress & Live Counter */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-secondary font-mono">
            <span className="flex items-center gap-1.5 text-amber-400/90">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Connecting automatically...</span>
            </span>
            <span className="text-muted">{connectDuration}s elapsed</span>
          </div>

          {/* Animated progress bar */}
          <div className="h-1.5 w-full bg-subtle/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.max(estimatedProgress, 8)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Initial brief connecting state (0-3s)
  if (connectionState === "connecting") {
    return (
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface/90 border border-default text-xs font-medium text-secondary shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-200",
          className
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
        <span>Connecting to real-time room...</span>
      </div>
    );
  }

  // Disconnected state with manual reconnect option
  if (connectionState === "disconnected") {
    return (
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface/95 border border-rose-500/20 text-xs font-medium shadow-xl backdrop-blur-md text-rose-300 animate-in fade-in duration-200",
          className
        )}
      >
        <WifiOff className="h-4 w-4 text-rose-400 shrink-0" />
        <span>Disconnected from real-time server</span>
        <button
          type="button"
          onClick={reconnect}
          className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[11px] font-semibold text-rose-200 transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return null;
}
