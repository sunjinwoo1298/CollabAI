"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UserPlus,
  Trash2,
  Copy,
  Check,
  Crown,
  Users,
  Loader2,
  Shield,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Collaborator {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  createdAt: string;
}

interface OwnerInfo {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
}

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  isOwner: boolean;
}

export function ShareDialog({
  isOpen,
  onClose,
  projectId,
  projectName,
  isOwner,
}: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch collaborators list when dialog opens
  const fetchCollaborators = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setInviteError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators`);
      if (response.ok) {
        const data = await response.json();
        setCollaborators(data.collaborators || []);
        if (data.owner) {
          setOwner(data.owner);
        }
      }
    } catch (err) {
      console.error("Failed to load collaborators:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      fetchCollaborators();
      setInviteEmail("");
      setInviteError(null);
      setCopied(false);
    }
  }, [isOpen, fetchCollaborators]);

  // Invite collaborator handler
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed || isInviting) return;

    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    setIsInviting(true);
    setInviteError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite collaborator");
      }

      if (data.collaborator) {
        setCollaborators((prev) => [...prev, data.collaborator]);
      }
      setInviteEmail("");
    } catch (err: any) {
      setInviteError(err.message || "Failed to invite collaborator");
    } finally {
      setIsInviting(false);
    }
  };

  // Remove collaborator handler
  const handleRemove = async (collaboratorId: string) => {
    if (removingId) return;
    setRemovingId(collaboratorId);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/collaborators/${collaboratorId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
      } else {
        const data = await response.json().catch(() => ({}));
        console.error("Failed to remove collaborator:", data.error);
      }
    } catch (err) {
      console.error("Error removing collaborator:", err);
    } finally {
      setRemovingId(null);
    }
  };

  // Copy project link handler with temporary feedback
  const handleCopyLink = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/editor/${projectId}`
        : "";

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const projectUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/editor/${projectId}`
      : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-surface border-default text-primary sm:max-w-lg p-6 sm:p-7 shadow-2xl">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand" />
            <DialogTitle className="text-primary text-lg font-semibold tracking-tight">
              Share Workspace
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted text-sm leading-relaxed">
            Invite collaborators to view and edit <span className="text-primary font-medium">{projectName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Owner Invite Form (Owners only) */}
          {isOwner ? (
            <form onSubmit={handleInvite} className="space-y-2">
              <label
                htmlFor="invite-email-input"
                className="text-xs font-medium text-secondary flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5 text-muted" />
                Invite by Email
              </label>
              <div className="flex gap-2">
                <Input
                  id="invite-email-input"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  placeholder="colleague@example.com"
                  className="bg-subtle border-default text-primary placeholder:text-faint h-10 px-3 flex-1"
                  disabled={isInviting}
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  variant="default"
                  disabled={!inviteEmail.trim() || isInviting}
                  className="gap-1.5 px-4 h-10 font-medium shrink-0"
                >
                  {isInviting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  <span>Invite</span>
                </Button>
              </div>

              {inviteError && (
                <p className="text-xs text-error mt-1">{inviteError}</p>
              )}
            </form>
          ) : (
            /* Read-only notification for Collaborators */
            <div className="p-3 rounded-lg bg-subtle border border-default flex items-start gap-2.5 text-xs text-muted">
              <Shield className="h-4 w-4 text-ai shrink-0 mt-0.5" />
              <span>
                You have collaborator access. Only the project owner can invite or remove members.
              </span>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-secondary">
              Members with Access
            </h4>

            <div className="rounded-lg border border-default bg-subtle/50 overflow-hidden">
              {isLoading ? (
                <div className="p-6 flex items-center justify-center text-muted gap-2 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  <span>Loading members...</span>
                </div>
              ) : (
                <ScrollArea className="max-h-56">
                  <div className="divide-y divide-default/40">
                    {/* Owner Row */}
                    {owner && (
                      <div className="flex items-center justify-between p-3 gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {owner.imageUrl ? (
                            <img
                              src={owner.imageUrl}
                              alt={owner.name}
                              className="h-8 w-8 rounded-full border border-default object-cover shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-xs font-semibold text-brand shrink-0">
                              {owner.name.charAt(0).toUpperCase() || "O"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-primary truncate">
                              {owner.name}
                            </p>
                            <p className="text-[11px] text-muted truncate">
                              {owner.email || "Project Owner"}
                            </p>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand/10 text-brand border border-brand/20 shrink-0">
                          <Crown className="h-3 w-3" /> Owner
                        </span>
                      </div>
                    )}

                    {/* Collaborator Rows */}
                    {collaborators.map((collaborator) => (
                      <div
                        key={collaborator.id}
                        className="flex items-center justify-between p-3 gap-3 hover:bg-subtle transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {collaborator.imageUrl ? (
                            <img
                              src={collaborator.imageUrl}
                              alt={collaborator.name || collaborator.email}
                              className="h-8 w-8 rounded-full border border-default object-cover shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-ai/10 border border-ai/30 flex items-center justify-center text-xs font-semibold text-ai shrink-0">
                              {(collaborator.name || collaborator.email)
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            {collaborator.name ? (
                              <>
                                <p className="text-xs font-medium text-primary truncate">
                                  {collaborator.name}
                                </p>
                                <p className="text-[11px] text-muted truncate">
                                  {collaborator.email}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs font-medium text-primary truncate">
                                {collaborator.email}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted hidden sm:inline">
                            Collaborator
                          </span>

                          {/* Remove button (Owners only) */}
                          {isOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemove(collaborator.id)}
                              disabled={removingId === collaborator.id}
                              className="h-7 w-7 text-muted hover:text-destructive hover:bg-elevated rounded-md"
                              title={`Remove ${collaborator.name || collaborator.email}`}
                              aria-label={`Remove ${collaborator.name || collaborator.email}`}
                            >
                              {removingId === collaborator.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Empty collaborators state */}
                    {collaborators.length === 0 && !owner && (
                      <div className="p-4 text-center text-xs text-muted">
                        No collaborators added yet.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          {/* Copy Project Link */}
          <div className="space-y-2 pt-1 border-t border-default/60">
            <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
              <Copy className="h-3.5 w-3.5 text-muted" />
              Project Link
            </label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={projectUrl}
                className="bg-subtle border-default text-muted font-mono text-[11px] h-9 px-3 flex-1 select-all cursor-text"
              />
              <Button
                type="button"
                variant={copied ? "default" : "outline"}
                size="sm"
                onClick={handleCopyLink}
                className={cn(
                  "h-9 px-3 gap-1.5 text-xs font-medium shrink-0 transition-all",
                  copied
                    ? "bg-success text-base border-success hover:bg-success"
                    : "border-default text-primary hover:bg-subtle"
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareDialog;
