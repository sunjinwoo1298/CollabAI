import { SignIn } from "@clerk/nextjs";
import { History, Share2, FileText } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-base flex">
      {/* Left Panel - Hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col border-r border-default bg-surface">
        {/* Logo at top left */}
        <div className="absolute top-8 left-8 flex items-center gap-3">
          <div className="w-6 h-6 bg-brand rounded-sm"></div>
          <span className="font-semibold text-lg text-primary tracking-wide">Collab AI</span>
        </div>

        {/* Centered Content */}
        <div className="flex-1 flex flex-col justify-center px-16 xl:px-24">
          <h1 className="text-4xl xl:text-5xl font-bold text-primary mb-6 leading-tight">
            Design systems at the<br />speed of thought.
          </h1>
          <p className="text-lg text-secondary mb-12 max-w-lg leading-relaxed">
            Describe your architecture in plain English. Collab AI maps it to a shared canvas your whole team can refine in real time.
          </p>

          <div className="space-y-8">
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0 mt-1 p-2 bg-surface rounded-md border border-default">
                <History className="h-4 w-4 text-brand" />
              </div>
              <div>
                <h3 className="text-primary font-medium mb-1">AI Architecture Generation</h3>
                <p className="text-muted text-sm leading-relaxed max-w-md">
                  Describe your system, AI maps it to nodes and edges on a live canvas.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0 mt-1 p-2 bg-surface rounded-md border border-default">
                <Share2 className="h-4 w-4 text-brand" />
              </div>
              <div>
                <h3 className="text-primary font-medium mb-1">Real-time Collaboration</h3>
                <p className="text-muted text-sm leading-relaxed max-w-md">
                  Live cursors, presence indicators, and shared node editing across your team.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0 mt-1 p-2 bg-surface rounded-md border border-default">
                <FileText className="h-4 w-4 text-brand" />
              </div>
              <div>
                <h3 className="text-primary font-medium mb-1">Instant Spec Generation</h3>
                <p className="text-muted text-sm leading-relaxed max-w-md">
                  Export a complete Markdown technical spec directly from the canvas graph.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Clerk Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-base">
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
}
