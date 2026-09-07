"use client";

import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  slugPreview: string;
  onSubmit: () => void;
  isLoading?: boolean;
}

export function CreateProjectDialog({
  isOpen,
  onClose,
  name,
  onNameChange,
  slugPreview,
  onSubmit,
  isLoading = false,
}: CreateProjectDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-surface border-default text-primary sm:max-w-md p-6 sm:p-7">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-primary text-lg font-semibold tracking-tight">
              Create Project
            </DialogTitle>
            <DialogDescription className="text-muted text-sm leading-relaxed">
              Enter a name for your new architecture workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <label htmlFor="create-project-name" className="text-xs font-medium text-secondary">
              Project Name
            </label>
            <Input
              id="create-project-name"
              ref={inputRef}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., Payment Gateway System"
              className="bg-subtle border-default text-primary placeholder:text-faint h-10 px-3"
              disabled={isLoading}
              autoComplete="off"
            />

            <div className="pt-1.5 flex items-center gap-1.5 text-xs text-muted">
              <span>Room ID:</span>
              <code className="bg-subtle border border-default text-brand px-2 py-0.5 rounded font-mono text-[11px] truncate max-w-[280px]">
                {slugPreview ? slugPreview : "..."}
              </code>
            </div>
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="border-default text-secondary hover:text-primary px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={!name.trim() || isLoading}
              className="px-5 py-2 font-medium"
            >
              {isLoading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
