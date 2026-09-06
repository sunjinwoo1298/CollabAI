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

interface RenameProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectName: string;
  name: string;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export function RenameProjectDialog({
  isOpen,
  onClose,
  currentProjectName,
  name,
  onNameChange,
  onSubmit,
  isLoading = false,
}: RenameProjectDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
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
              Rename Project
            </DialogTitle>
            <DialogDescription className="text-muted text-sm leading-relaxed">
              Update the name for{" "}
              <span className="text-primary font-medium">{currentProjectName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <label htmlFor="rename-project-name" className="text-xs font-medium text-secondary">
              Project Name
            </label>
            <Input
              id="rename-project-name"
              ref={inputRef}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter project name..."
              className="bg-subtle border-default text-primary placeholder:text-faint h-10 px-3"
              disabled={isLoading}
              autoComplete="off"
            />
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
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
