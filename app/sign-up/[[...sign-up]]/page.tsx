import { SignUp } from "@clerk/nextjs";
import { Cpu, CheckCircle2 } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-base text-primary flex">
      {/* Left Panel - Hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 border-r border-default bg-surface">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Cpu className="text-brand h-8 w-8" />
            <h1 className="text-3xl font-bold">Ghost AI</h1>
          </div>
          <p className="text-xl text-secondary mb-12">
            Join the collaborative environment for distributed systems design and AI generation.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-brand h-5 w-5" />
              <span className="text-primary">Real-time collaborative editing</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-brand h-5 w-5" />
              <span className="text-primary">AI-powered architecture generation</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-brand h-5 w-5" />
              <span className="text-primary">Dark-first design tokens</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Clerk Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <SignUp />
      </div>
    </div>
  );
}
