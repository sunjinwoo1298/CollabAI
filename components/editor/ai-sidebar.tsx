"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  Bot,
  X,
  Send,
  Sparkles,
  FileText,
  FileCode,
  Download,
  ArrowRight,
  Clock,
  Layers,
  Loader2,
  MessageSquare,
  WifiOff,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { RemoteCollaborator } from "@/types/canvas";
import {
  TaskStatusPayload,
  AiActivityState,
  createInitialAiActivityState,
  applyAiStatusUpdate,
} from "@/types/tasks";
import { WebsocketProvider } from "y-websocket";
import { useRoomChat } from "@/hooks/useRoomChat";
import { RoomChatMessage } from "@/types/collaboration";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | string;
  content: string;
  timestamp: string;
  role?: "user" | "assistant";
  senderId?: string;
  projectId?: string;
}

export const STARTER_PROMPTS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
] as const;

export interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  collaborators?: RemoteCollaborator[];
  activeRunId?: string | null;
  onStatusChange?: (status: TaskStatusPayload | null) => void;
  provider?: WebsocketProvider | null;
  currentUserId?: string;
}

export function formatMessageTime(isoString?: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function AiSidebar({
  isOpen,
  onClose,
  projectId,
  collaborators = [],
  activeRunId: propActiveRunId,
  onStatusChange,
  provider,
  currentUserId: propCurrentUserId,
}: AiSidebarProps) {
  const { user: clerkUser } = useUser();
  const effectiveUserId = propCurrentUserId || clerkUser?.id;

  const [activeTab, setActiveTab] = useState<string>("architect");
  const [inputValue, setInputValue] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(propActiveRunId || null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(Boolean(propActiveRunId));
  const [localError, setLocalError] = useState<string | null>(null);
  const completedRunIdsRef = useRef<Set<string>>(new Set());

  const [activityState, setActivityState] = useState<AiActivityState>(() => {
    const initial = createInitialAiActivityState();
    if (propActiveRunId) {
      initial.activeRunId = propActiveRunId;
      initial.isGenerating = true;
    }
    return initial;
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Hook for room-scoped collaborative chat feed
  const {
    messages,
    isLoadingHistory,
    isSending,
    error: sendError,
    sendMessage,
    clearError: clearChatError,
  } = useRoomChat({
    projectId,
    provider,
    currentUserId: effectiveUserId,
  });

  // 1. Auto-restore active run and fetch scoped token across reloads/remounts
  useEffect(() => {
    let isCancelled = false;

    async function restoreRun() {
      if (!projectId) return;

      try {
        let runToTrack = activeRunId;

        // If no active run ID in state, check server TaskRun table
        if (!runToTrack) {
          const res = await fetch(`/api/ai/design?projectId=${encodeURIComponent(projectId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.runId) {
              runToTrack = data.runId;
              if (!isCancelled) {
                setActiveRunId(data.runId);
                setIsRunning(true);
              }
            }
          }
        }

        // If run ID is present but no scoped public token, acquire token
        if (runToTrack && !publicToken) {
          const tokenRes = await fetch("/api/ai/design/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runId: runToTrack }),
          });

          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            const tok = tokenData.publicToken || tokenData.token;
            if (tok && !isCancelled) {
              setPublicToken(tok);
            }
          }
        }
      } catch (err: any) {
        console.warn("[AiSidebar] Run restoration warning:", err?.message);
      }
    }

    restoreRun();

    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  // 2. Realtime run subscription via installed Trigger.dev SDK
  const { run, error: realtimeError } = useRealtimeRun(activeRunId ?? undefined, {
    accessToken: publicToken ?? undefined,
    enabled: Boolean(activeRunId && publicToken),
  });

  useEffect(() => {
    if (realtimeError && activeRunId) {
      console.warn("[AiSidebar] Trigger.dev realtime subscription notice:", realtimeError.message);
    }
  }, [realtimeError, activeRunId]);

  // 3. Handle run terminal states and completion/failure messages
  useEffect(() => {
    if (!activeRunId) return;

    // Check Trigger.dev run terminal state
    if (run) {
      const isTerminalSuccess =
        run.isSuccess ||
        run.status === "COMPLETED";

      const isTerminalFailure =
        run.isFailed ||
        run.isCancelled ||
        ["FAILED", "CANCELED", "CRASHED", "TIMED_OUT", "SYSTEM_FAILURE", "EXPIRED"].includes(
          run.status
        );

      if (isTerminalSuccess) {
        if (!completedRunIdsRef.current.has(activeRunId)) {
          completedRunIdsRef.current.add(activeRunId);

          const summary =
            (run.output as any)?.summary ||
            "AI Architect updated the architecture canvas.";

          sendMessage(summary, activeRunId).catch(() => {});
        }

        setIsRunning(false);
        setActiveRunId(null);
        setPublicToken(null);
        setActivityState((prev) => ({
          ...prev,
          isGenerating: false,
          activeRunId: null,
        }));
      } else if (isTerminalFailure) {
        if (!completedRunIdsRef.current.has(activeRunId)) {
          completedRunIdsRef.current.add(activeRunId);

          const errMsg =
            run.error?.message ||
            `AI design task finished with status: ${run.status}`;
          setLocalError(errMsg);
        }

        setIsRunning(false);
        setActiveRunId(null);
        setPublicToken(null);
        setActivityState((prev) => ({
          ...prev,
          isGenerating: false,
          activeRunId: null,
        }));
      }
    }

    // Check Yjs awareness terminal state (for multi-client awareness sync)
    if (
      activityState.status &&
      activityState.status.runId === activeRunId
    ) {
      if (activityState.status.status === "completed") {
        if (!completedRunIdsRef.current.has(activeRunId)) {
          completedRunIdsRef.current.add(activeRunId);

          const summary =
            activityState.status.text ||
            activityState.status.statusMessage ||
            "AI Architect updated the architecture canvas.";

          sendMessage(summary, activeRunId).catch(() => {});
        }

        setIsRunning(false);
        setActiveRunId(null);
        setPublicToken(null);
      } else if (activityState.status.status === "failed") {
        if (!completedRunIdsRef.current.has(activeRunId)) {
          completedRunIdsRef.current.add(activeRunId);

          const errMsg =
            activityState.status.text ||
            activityState.status.statusMessage ||
            "AI design generation failed.";
          setLocalError(errMsg);
        }

        setIsRunning(false);
        setActiveRunId(null);
        setPublicToken(null);
      }
    }
  }, [run, activeRunId, activityState.status, sendMessage]);

  // Synchronize AI activity state from real-time collaborator awareness
  useEffect(() => {
    if (!collaborators || collaborators.length === 0) return;

    // Scan collaborators for AI agent peer or peer with active AI state
    const aiPeer = collaborators.find(
      (c) => c.user?.userId === "ai-agent" || Boolean(c.runId)
    );

    if (aiPeer) {
      const candidatePayload: TaskStatusPayload = {
        runId: aiPeer.runId || "",
        projectId: aiPeer.projectId || projectId || "",
        thinking: aiPeer.thinking,
        isThinking: aiPeer.isThinking,
        text: aiPeer.text || aiPeer.statusMessage,
        statusMessage: aiPeer.statusMessage || aiPeer.text,
        status: aiPeer.status,
        timestamp: aiPeer.timestamp,
      };

      setActivityState((prev) => {
        const { nextState, accepted } = applyAiStatusUpdate(
          prev,
          candidatePayload,
          projectId
        );
        return accepted ? nextState : prev;
      });
    } else {
      // If no AI peer is present and we were generating without active local run, clear state
      if (activityState.isGenerating && !isRunning && !isSubmitting) {
        setActivityState((prev) => ({
          ...prev,
          isGenerating: false,
          activeRunId: null,
        }));
      }
    }
  }, [collaborators, projectId, activityState.isGenerating, isRunning, isSubmitting]);

  // Notify parent of status changes if requested
  useEffect(() => {
    onStatusChange?.(activityState.status);
  }, [activityState.status, onStatusChange]);

  const isGenerationActive =
    activityState.isGenerating || isRunning || isSubmitting;

  const latestStatusText =
    activityState.status?.text ||
    activityState.status?.statusMessage ||
    (isSubmitting
      ? "Starting design agent..."
      : isRunning
      ? "AI Architect is designing architecture..."
      : "");

  // Auto-scroll to latest message on update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Auto-resize textarea based on content (between 72px and 160px)
  const adjustTextareaHeight = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    const newHeight = Math.min(Math.max(element.scrollHeight, 72), 160);
    element.style.height = `${newHeight}px`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustTextareaHeight(e.target);
  };

  // 4. Submit design prompt: publish to room chat and trigger AI design agent
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim();
    if (!text || isSubmitting || isRunning || isGenerationActive || isSending) {
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);
    clearChatError();

    try {
      // 1. Post user prompt to room chat feed
      const chatSent = await sendMessage(text);
      if (!chatSent) {
        throw new Error("Failed to send message to room chat");
      }

      // 2. Submit prompt to /api/ai/design endpoint with project identity
      const designRes = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          roomId: projectId,
          projectId: projectId,
        }),
      });

      if (!designRes.ok) {
        const errData = await designRes.json().catch(() => ({}));
        throw new Error(
          errData.error || `Design generation failed (Status ${designRes.status})`
        );
      }

      const designData = await designRes.json();
      const runId = designData.runId;

      if (!runId || typeof runId !== "string") {
        throw new Error("Invalid response: missing runId from design service");
      }

      // 3. Acquire scoped public token for realtime tracking
      const tokenRes = await fetch("/api/ai/design/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      if (!tokenRes.ok) {
        const tokenErrData = await tokenRes.json().catch(() => ({}));
        throw new Error(
          tokenErrData.error ||
            `Failed to acquire run token (Status ${tokenRes.status})`
        );
      }

      const tokenData = await tokenRes.json();
      const publicToken = tokenData.publicToken || tokenData.token;

      if (!publicToken || typeof publicToken !== "string") {
        throw new Error("Invalid response: missing publicToken from token service");
      }

      // Successful submission: clear input and set active tracking states
      setInputValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "72px";
      }

      setActiveRunId(runId);
      setPublicToken(publicToken);
      setIsRunning(true);
      setActivityState((prev) => ({
        ...prev,
        activeRunId: runId,
        isGenerating: true,
      }));
    } catch (err: any) {
      // On failure, preserve prompt in textarea and show visible error
      setLocalError(err.message || "Failed to start AI design task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectStarterPrompt = (prompt: string) => {
    setInputValue(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
      setTimeout(() => {
        if (textareaRef.current) {
          adjustTextareaHeight(textareaRef.current);
        }
      }, 0);
    }
  };

  const displayError = localError || sendError;
  const clearAllErrors = () => {
    setLocalError(null);
    clearChatError();
  };

  if (!isOpen) return null;

  return (
    <aside
      className="absolute inset-y-0 right-0 w-80 lg:w-96 border-l border-default bg-base/95 backdrop-blur-xl flex flex-col h-full z-40 shadow-2xl animate-in slide-in-from-right duration-200"
      aria-label="AI Workspace"
    >
      {/* 1. Header */}
      <div className="h-14 border-b border-default px-4 flex items-center justify-between shrink-0 bg-surface/30">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-ai/10 border border-ai/20 flex items-center justify-center text-ai shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary leading-none tracking-tight">
              AI Workspace
            </h3>
            <p className="text-[11px] text-muted mt-0.5 leading-none">
              Room Chat & Architecture
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 text-muted hover:text-primary rounded-lg transition-colors cursor-pointer"
          title="Close AI Workspace"
          aria-label="Close AI Workspace"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 2. Tabs Layout */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-4 pt-3 pb-2 shrink-0 border-b border-default/40">
          <TabsList className="w-full grid grid-cols-2 bg-subtle/80 p-1 rounded-xl border border-default/60">
            <TabsTrigger
              value="architect"
              className={cn(
                "rounded-lg text-xs font-medium py-1.5 transition-all text-muted",
                "data-[state=active]:bg-elevated data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-default"
              )}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-ai" />
              Room Chat
            </TabsTrigger>
            <TabsTrigger
              value="specs"
              className={cn(
                "rounded-lg text-xs font-medium py-1.5 transition-all text-muted",
                "data-[state=active]:bg-elevated data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-default"
              )}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5 text-brand" />
              Specs
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 3. AI Architect / Room Chat Tab Content */}
        <TabsContent
          value="architect"
          className="flex-1 flex flex-col min-h-0 data-[state=inactive]:hidden m-0 p-0"
        >
          {/* Scrollable Chat Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {isLoadingHistory && messages.length === 0 ? (
              /* Loading State */
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <Loader2 className="h-5 w-5 animate-spin text-ai" />
                <span className="text-xs text-muted">Loading room chat history...</span>
              </div>
            ) : messages.length === 0 ? (
              /* Empty State */
              <div className="h-full flex flex-col items-center justify-center text-center px-2 py-6 space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-ai/10 border border-ai/20 flex items-center justify-center text-ai shadow-inner">
                  <MessageSquare className="h-6 w-6" />
                </div>

                <div className="space-y-1.5 max-w-xs">
                  <h4 className="text-sm font-semibold text-primary">
                    Project Room Chat
                  </h4>
                  <p className="text-xs text-muted leading-relaxed">
                    Collaborate with project members in real time. Exchange messages or explore system architecture ideas together.
                  </p>
                </div>

                {/* Starter Prompt Chips */}
                <div className="w-full pt-3 space-y-2 text-left">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted px-1 flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-ai" />
                    Starter Suggestions
                  </span>
                  <div className="space-y-1.5">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSelectStarterPrompt(prompt)}
                        className="w-full bg-subtle hover:bg-elevated border border-default/70 hover:border-ai/40 text-xs text-ai-muted hover:text-primary px-3.5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between group shadow-sm text-left"
                      >
                        <span className="truncate pr-2">{prompt}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted opacity-40 group-hover:opacity-100 group-hover:text-ai group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Message List */
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isAi =
                    msg.senderId === "ai-agent" ||
                    msg.sender === "Collab AI" ||
                    msg.sender === "AI Architect" ||
                    (msg as any).role === "assistant";

                  const isCurrentUser =
                    !isAi &&
                    (Boolean(effectiveUserId && msg.senderId === effectiveUserId) ||
                      msg.sender === "user" ||
                      msg.sender === "You");

                  return (
                    <div
                      key={msg.id}
                      data-testid={`chat-message-${msg.id}`}
                      className={cn(
                        "flex flex-col",
                        isCurrentUser ? "items-end" : "items-start"
                      )}
                    >
                      {!isCurrentUser && (
                        <span
                          className={cn(
                            "text-[10px] font-semibold mb-1 px-1 flex items-center gap-1.5",
                            isAi ? "text-ai" : "text-brand"
                          )}
                        >
                          {isAi ? (
                            <Bot className="h-3 w-3 text-ai" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                          )}
                          {msg.sender}
                        </span>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] text-xs leading-relaxed p-3 shadow-sm break-words whitespace-pre-wrap",
                          isCurrentUser
                            ? "bg-brand-dim border-2 border-brand/50 text-primary rounded-2xl rounded-tr-sm"
                            : isAi
                            ? "bg-elevated border border-default text-primary rounded-2xl rounded-tl-sm shadow-md"
                            : "bg-elevated border border-default text-secondary rounded-2xl rounded-tl-sm"
                        )}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-muted font-mono mt-1 px-1">
                        {formatMessageTime(msg.timestamp)}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-default bg-base/80 backdrop-blur-md shrink-0 space-y-2">
            {/* Non-blocking error alert */}
            {displayError && (
              <div
                data-testid="chat-send-error"
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive animate-in fade-in duration-150"
              >
                <span className="truncate">{displayError}</span>
                <button
                  type="button"
                  onClick={clearAllErrors}
                  className="text-destructive hover:opacity-75 transition-opacity cursor-pointer shrink-0"
                  title="Dismiss error"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Small status indicator for active AI background generation */}
            {isGenerationActive && latestStatusText && (
              <div
                data-testid="ai-status-indicator"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ai/10 border border-ai/20 text-xs text-ai animate-in fade-in duration-150"
              >
                <Loader2
                  data-testid="ai-status-spinner"
                  className="h-3 w-3 animate-spin shrink-0 text-ai"
                />
                <span className="truncate font-medium">{latestStatusText}</span>
              </div>
            )}

            <div className="relative rounded-xl border border-default bg-subtle focus-within:border-ai/60 focus-within:ring-1 focus-within:ring-ai/60 transition-all shadow-sm">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting || isRunning || isGenerationActive || isSending}
                placeholder={
                  isSubmitting
                    ? "Starting design agent..."
                    : isRunning || isGenerationActive
                    ? "AI Architect is designing architecture..."
                    : isSending
                    ? "Sending message..."
                    : "Ask AI Architect or message collaborators... (Enter to send)"
                }
                className={cn(
                  "min-h-[72px] max-h-[160px] resize-none border-0 bg-transparent px-3 py-2.5 text-xs text-primary placeholder:text-muted focus-visible:ring-0 focus-visible:outline-none",
                  (isSubmitting || isRunning || isGenerationActive || isSending) &&
                    "opacity-50 cursor-not-allowed"
                )}
              />
              <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                <span className="text-[10px] text-muted font-mono">
                  Shift+Enter for newline
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSendMessage()}
                  disabled={
                    isSubmitting ||
                    isRunning ||
                    isGenerationActive ||
                    isSending ||
                    !inputValue.trim()
                  }
                  className="h-7 px-2.5 text-xs font-medium rounded-lg bg-ai hover:bg-ai/90 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  {isSubmitting || isRunning || isGenerationActive || isSending ? (
                    <>
                      <Loader2
                        data-testid="send-loading-spinner"
                        className="h-3 w-3 animate-spin"
                      />
                      <span>
                        {isSubmitting
                          ? "Starting..."
                          : isRunning || isGenerationActive
                          ? "Generating..."
                          : "Sending..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3" />
                      <span>Send</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 4. Specs Tab Content */}
        <TabsContent
          value="specs"
          className="flex-1 flex flex-col min-h-0 data-[state=inactive]:hidden m-0 p-4 space-y-4 overflow-y-auto"
        >
          {/* Action Trigger */}
          <div>
            <Button
              type="button"
              className="w-full h-9 rounded-xl bg-ai hover:bg-ai/90 text-white font-medium text-xs shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Generate Spec</span>
            </Button>
          </div>

          {/* Demo Spec Card */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted px-1 flex items-center gap-1.5">
              <FileCode className="h-3 w-3 text-brand" />
              Generated Specifications
            </span>

            <div className="rounded-2xl border border-default bg-elevated p-4 space-y-3.5 shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-ai/10 border border-ai/20 flex items-center justify-center text-ai shrink-0 mt-0.5">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-primary tracking-tight">
                      System Architecture Spec v1.0
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted font-mono mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>Ready for download</span>
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-brand-dim text-brand border border-brand/30 shrink-0">
                  Demo
                </span>
              </div>

              <p className="text-xs text-muted leading-relaxed line-clamp-3 bg-subtle/50 p-2.5 rounded-xl border border-default/40">
                Comprehensive architectural specification covering microservices topology, caching tiers, database schemas, and event queues for high-concurrency cloud systems.
              </p>

              <Button
                disabled
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs font-medium rounded-xl border-default text-muted opacity-50 cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                title="Download Spec will be activated in upcoming spec persistence module"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Spec (PDF / MD)</span>
              </Button>
            </div>
          </div>

          {/* Info Banner */}
          <div className="p-3 rounded-xl bg-subtle/60 border border-default/60 text-xs text-muted space-y-1">
            <p className="font-medium text-primary text-[11px]">
              How Spec Generation Works
            </p>
            <p className="text-[11px] leading-relaxed">
              Collab AI synthesizes your live canvas nodes, ports, and connection edges into structured, production-ready technical specifications.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

export default AiSidebar;
