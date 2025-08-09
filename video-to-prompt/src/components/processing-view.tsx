export function ProcessingView() {
  return (
    <div className="w-full flex flex-col items-center gap-4 py-8">
      <div className="h-8 w-8 border-4 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      <div className="text-sm text-muted-foreground">Analyzing workflow...</div>
    </div>
  );
}


