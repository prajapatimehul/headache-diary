"use client";

import { Heart } from "lucide-react";

/**
 * Validation + crisis support. Daily unexplained pain commonly drives despair
 * (multiple threads showed suicidal ideation). Shown on the cause/learn pages.
 */
export function CrisisSupport() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Heart className="size-4 text-primary" />
        <h2 className="font-display text-lg">You&rsquo;re not imagining this</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Daily, unexplained pain is exhausting and it is real — you are not
        weak, dramatic, or drug-seeking for wanting an answer. A daily headache
        is never &ldquo;normal,&rdquo; and most people who keep pushing do
        eventually find a cause or a treatment that helps. Don&rsquo;t give up.
      </p>
      <p className="mt-3 text-sm">
        If the pain ever makes you think about ending things, please reach out
        now — you deserve support:
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          <span className="font-medium">India — Tele-MANAS:</span>{" "}
          <a href="tel:14416" className="text-primary underline">
            14416
          </a>{" "}
          (24/7)
        </li>
        <li>
          <span className="font-medium">India — iCall:</span>{" "}
          <a href="tel:9152987821" className="text-primary underline">
            9152987821
          </a>
        </li>
        <li className="text-muted-foreground">
          Elsewhere: contact your local emergency number or a crisis line in
          your country.
        </li>
      </ul>
    </section>
  );
}
