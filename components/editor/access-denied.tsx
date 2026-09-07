import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccessDeniedProps {
  message?: string;
}

export function AccessDenied({
  message = "You don't have access to this project or it does not exist.",
}: AccessDeniedProps) {
  return (
    <div className="min-h-screen w-full bg-base text-primary flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface border border-default rounded-2xl p-8 text-center space-y-6 shadow-2xl">
        <div className="h-16 w-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto text-destructive shadow-xs">
          <Lock className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Access Denied
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            {message}
          </p>
        </div>

        <div className="pt-2">
          <Button asChild variant="default" className="gap-2 px-5 font-medium">
            <Link href="/editor">
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AccessDenied;
