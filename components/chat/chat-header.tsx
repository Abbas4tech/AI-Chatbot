import { CarIcon } from "lucide-react";

/**
 * Presentational branding header. No state, no props — extracted from
 * app/page.tsx per docs/adr/0011-modular-chat-components-solid-refactor.md.
 */
export function ChatHeader() {
  return (
    <header className="mb-5 flex items-center gap-3 border-b pb-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <CarIcon className="size-5" />
      </div>
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Mahindra AI Assistant
        </h1>
        <p className="text-muted-foreground text-sm">
          Ask about vehicles, check your booking, or log a service request.
        </p>
      </div>
    </header>
  );
}
