import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  message?: string;
  className?: string;
  spinnerClassName?: string;
}

export function Loading({ message = "Loading...", className, spinnerClassName }: LoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-4 space-y-2", className)}>
      <Loader2 className={cn("h-8 w-8 animate-spin text-primary", spinnerClassName)} />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
