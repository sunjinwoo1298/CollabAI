"use client";

import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorNavbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

import { UserButton } from "@clerk/nextjs";

export function EditorNavbar({ isSidebarOpen, onToggleSidebar }: EditorNavbarProps) {
  return (
    <header className="h-14 border-b border-default bg-base flex items-center justify-between px-4 shrink-0 z-50">
      <div className="flex items-center gap-2 w-1/3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggleSidebar} 
          className="text-muted hover:text-primary"
        >
          {isSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </Button>
      </div>
      <div className="flex items-center justify-center w-1/3">
        {/* Center section empty for now */}
      </div>
      <div className="flex items-center justify-end w-1/3 gap-2">
        <UserButton />
      </div>
    </header>
  );
}
