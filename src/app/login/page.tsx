import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-6">
      {/* very dark radial wash — calm, low-glare (see DESIGN.md) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_60%)]"
      />

      <div className="relative w-full max-w-sm">
        <header className="mb-8 space-y-3 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-border bg-card text-2xl shadow-sm">
            <span aria-hidden>🧠</span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Headache Diary
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Track your pain. Get a doctor-ready report. Sign in to sync across
            your devices.
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Your entries are saved on this device and sync privately to your
          account.
        </p>
      </div>
    </main>
  );
}
