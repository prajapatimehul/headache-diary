export const dynamic = "force-static";

export const metadata = {
  title: "Offline — Headache Diary",
};

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-10 text-center text-foreground">
      <div className="max-w-sm space-y-4">
        <p
          aria-hidden
          className="font-display text-4xl tabular-nums text-muted-foreground"
        >
          ⌁
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          You&rsquo;re offline
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Headache Diary works offline. Your entries are saved on this device
          and sync automatically when you&rsquo;re back online.
        </p>
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-left">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Open the app again once your connection returns — nothing you logged
            is lost.
          </p>
        </div>
      </div>
    </main>
  );
}
