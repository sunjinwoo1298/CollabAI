"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteProjectDialog({
  isOpen,
  onClose,
  projectName,
  onConfirm,
  isLoading = false,
}: DeleteProjectDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-surface border-default text-primary sm:max-w-md p-6 sm:p-7">
        <div className="space-y-5">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-primary text-lg font-semibold tracking-tight">
              Delete Project
            </DialogTitle>
            <DialogDescription className="text-muted text-sm leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="text-primary font-medium">{projectName}</span>? This action cannot be
              undone and will permanently remove all workspace diagrams and specs.
            </DialogDescription>
          </DialogHeader>

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
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isLoading}
              className="px-5 py-2 font-medium"
            >
              {isLoading ? "Deleting..." : "Delete Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
