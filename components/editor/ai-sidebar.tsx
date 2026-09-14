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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: string;
}

export const STARTER_PROMPTS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
] as const;

interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiSidebar({ isOpen, onClose }: AiSidebarProps) {
  const [activeTab, setActiveTab] = useState<string>("architect");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "72px";
    }

    // Interactive assistant response placeholder for UI feedback
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        content: `I analyzed your architecture query: "${text}". The AI design engine will generate topology nodes and spec documents based on your canvas layout.`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 400);
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
              Collaborate with Collab AI
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
              AI Architect
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

        {/* 3. AI Architect Tab Content */}
        <TabsContent
          value="architect"
          className="flex-1 flex flex-col min-h-0 data-[state=inactive]:hidden m-0 p-0"
        >
          {/* Scrollable Chat Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.length === 0 ? (
              /* Empty State */
              <div className="h-full flex flex-col items-center justify-center text-center px-2 py-6 space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-ai/10 border border-ai/20 flex items-center justify-center text-ai shadow-inner">
                  <Bot className="h-6 w-6" />
                </div>

                <div className="space-y-1.5 max-w-xs">
                  <h4 className="text-sm font-semibold text-primary">
                    AI Architect Assistant
                  </h4>
                  <p className="text-xs text-muted leading-relaxed">
                    Collaborate with Collab AI to design distributed systems, generate topology nodes, or optimize data pipelines.
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
                  const isUser = msg.sender === "user";
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col",
                        isUser ? "items-end" : "items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] text-xs leading-relaxed p-3 shadow-sm",
                          isUser
                            ? "bg-brand-dim border-2 border-brand/50 text-primary rounded-2xl rounded-tr-sm"
                            : "bg-elevated border border-default text-secondary rounded-2xl rounded-tl-sm"
                        )}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-muted font-mono mt-1 px-1">
                        {msg.timestamp}
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
            <div className="relative rounded-xl border border-default bg-subtle focus-within:border-ai/60 focus-within:ring-1 focus-within:ring-ai/60 transition-all shadow-sm">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask Collab AI to design or modify architecture... (Enter to send)"
                className="min-h-[72px] max-h-[160px] resize-none border-0 bg-transparent px-3 py-2.5 text-xs text-primary placeholder:text-muted focus-visible:ring-0 focus-visible:outline-none"
              />
              <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                <span className="text-[10px] text-muted font-mono">
                  Shift+Enter for newline
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim()}
                  className="h-7 px-2.5 text-xs font-medium rounded-lg bg-ai hover:bg-ai/90 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Send className="h-3 w-3" />
                  <span>Send</span>
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
