import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[60vh] w-full flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
      <p className="text-muted-foreground mt-4 font-medium animate-pulse">Loading data...</p>
    </div>
  );
}
