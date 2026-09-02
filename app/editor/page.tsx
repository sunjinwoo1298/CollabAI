"use client";

import { useState } from "react";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-base text-primary flex flex-col overflow-hidden">
      <EditorNavbar 
        isSidebarOpen={isSidebarOpen} 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
      />
      
      <div className="flex-1 relative flex overflow-hidden">
        <ProjectSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 overflow-auto p-8">
          <div className="flex flex-col gap-8">
            <header className="flex items-center justify-between border-b border-default pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="text-brand h-6 w-6" /> Ghost AI Design System
          </h1>
          <p className="text-sm text-muted">
            Foundation primitives & dark-only design token verification
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" className="gap-2">
            <Sparkles className="h-4 w-4" /> Generate
          </Button>
          <Button variant="outline">Settings</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card & Dialog */}
        <Card className="bg-surface border-default">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <CheckCircle2 className="text-brand h-5 w-5" /> Modal / Dialog Primitive
            </CardTitle>
            <CardDescription className="text-muted">
              Overlay dialog matching dark system theme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-secondary">
              Test opening the modal dialog to verify radix dialog styles and portal overlays.
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full">
                  Open Test Dialog
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-elevated border-default text-primary">
                <DialogHeader>
                  <DialogTitle>Dialog Verification</DialogTitle>
                  <DialogDescription className="text-muted">
                    This dialog is rendered inside Radix Portal with dark backdrop and tokens.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <Input placeholder="Sample system name..." className="bg-subtle border-default" />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button variant="default">Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
          <CardFooter className="text-xs text-faint">Dialog component verified</CardFooter>
        </Card>

        {/* Tabs & ScrollArea */}
        <Card className="bg-surface border-default">
          <CardHeader>
            <CardTitle className="text-primary">Tabs & ScrollArea</CardTitle>
            <CardDescription className="text-muted">
              Tab switching and customized viewport scrolling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-subtle w-full">
                <TabsTrigger value="overview" className="flex-1">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex-1">
                  Activity
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <p className="text-sm text-secondary">
                  Tokens: <span className="text-brand">Brand (#10B981)</span>,{" "}
                  <span className="text-ai">AI (#6366F1)</span>,{" "}
                  <span className="text-error">Error (#EF4444)</span>.
                </p>
              </TabsContent>
              <TabsContent value="logs" className="mt-4">
                <ScrollArea className="h-28 rounded-md border border-default p-2 bg-base">
                  <div className="space-y-1 text-xs text-muted">
                    <p>[00:01] System initialized in dark mode</p>
                    <p>[00:02] Loaded 7 shadcn/ui primitives</p>
                    <p>[00:03] Configured Tailwind v4 inline theme tokens</p>
                    <p>[00:04] Lucide icon bindings active</p>
                    <p>[00:05] Yjs room connection standing by</p>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Inputs & Textarea */}
        <Card className="bg-surface border-default">
          <CardHeader>
            <CardTitle className="text-primary">Form Controls</CardTitle>
            <CardDescription className="text-muted">
              Input and Textarea components
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Enter architecture title..." className="bg-subtle border-default" />
            <Textarea
              placeholder="Describe your distributed system in plain English..."
              className="bg-subtle border-default min-h-[80px]"
            />
          </CardContent>
          <CardFooter className="flex justify-between">
            <span className="text-xs text-faint flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-warning" /> Ready for AI prompt
            </span>
            <Button size="sm">Submit</Button>
          </CardFooter>
        </Card>
      </div>
          </div>
        </main>
      </div>
    </div>
  );
}

