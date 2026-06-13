import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Sign-in link problem",
};

export default function AuthCodeError() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="mx-auto max-w-sm space-y-5">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            This link didn&rsquo;t work
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The sign-in link may have expired or already been used. Magic links
            are single-use and time-limited. Request a fresh one to continue.
          </p>
        </div>
        <Button
          render={<Link href="/login" />}
          size="lg"
          className="h-11 w-full"
        >
          Back to sign in
        </Button>
      </div>
    </main>
  );
}
