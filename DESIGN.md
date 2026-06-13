# Headache Diary — Design Direction

> Concept: **a calm clinical instrument that feels like a premium consumer health app.** It is used by people *while in pain* — often photophobic — so every choice is filtered through: legible, low-glare, large targets, gentle motion. Nothing strobes. Nothing shouts. The only warmth in the interface is the pain itself.

## Core idea
**Cool, calm UI. Warm = pain.** The entire interface is a quiet, low-light instrument; the *only* hot colors in the product are the pain-intensity heat (markers on the 3D head, the trend bars). This makes the data the hero and keeps the chrome restful.

## Theme
- **Dark-first** (functional, not just aesthetic — photophobia-friendly default). Soft charcoal, never pure black.
- Light mode available (soft porcelain, never pure white — reduces glare).
- Respect `prefers-color-scheme` and `prefers-reduced-motion`.

## Color system (tokens)
```
/* base — dark */
--bg:        #0E1216;   /* deep ink, soft */
--surface:   #161C22;   /* cards / sheets */
--surface-2: #1E262E;   /* raised */
--line:      #2A333C;
--ink:       #E6EDF2;   /* primary text */
--muted:     #8A98A6;

/* signature accent — calm seafoam (NOT purple-on-white slop) */
--accent:    #57C7BE;   /* primary actions, focus */
--accent-dim:#2E4F4D;

/* pain heat scale (0 -> 10), the only warm range */
--h0:#3A4750; --h2:#3FB8A6; --h4:#E8C15A; --h6:#E89B43; --h8:#E0654B; --h10:#D7263D;
```
Heat is a continuous gradient teal→amber→coral→red mapped to 0–10. Calm at low pain, urgent at high.

## Typography (distinctive, not Inter/Roboto/Space Grotesk)
- **Display:** `Fraunces` (variable optical serif) — warm, human, premium; used for big numbers (intensity, day count), section titles. Soft, not stuffy.
- **Body / UI:** `Hanken Grotesk` — clean humanist grotesque, excellent legibility, good tabular figures for dates/scores.
- Generous line-height in body (1.55). Tabular numerals for all metrics.

## Motion
- Slow, eased, intentional (220–420ms, gentle spring). Photophobia-safe — no flashes, no high-contrast jitter.
- One orchestrated load: staggered reveal (head fades+settles, then cards rise).
- Bottom sheets spring up; the 3D head has rotational inertia.
- All gated behind `prefers-reduced-motion`.

## The 3D scene (the centerpiece)
- A softly-lit studio: neutral environment, soft key + cool rim light, a single grounded contact shadow.
- Head material: matte porcelain/graphite with a hint of subsurface softness — a premium product render, not a medical-textbook model.
- A faint translucent brain *inside* the head for orientation/beauty (not for clicking).
- Pain markers: soft glowing orbs whose color+bloom scale with intensity; they persist as a "pain constellation" that accumulates over days.
- Background: very dark radial gradient + faint film grain; the head floats, calm.
- Rotatable with inertia; tap places a marker (tap-vs-drag disambiguated).

## Mobile app shell
- **Bottom tab bar** (thumb-reachable, safe-area aware): **Today · Map · Insight · Export · You**.
- Top bar: date + "Day N" chip; minimal.
- **Bottom sheets** for entry detail (intensity slider, symptom chips) — big targets, one-thumb.
- Standalone PWA chrome (no browser bars); honors notch/home-indicator insets.
- Primary action always within thumb reach; destructive actions guarded.

## Signature, unforgettable element
The **3D head with living heat markers** + the **ICHD-3 verdict card that fills in as the diary grows** (Day 5 preliminary → Day 30 strong), turning daily logging into a visible, building answer.

## Accessibility
- WCAG AA contrast in both themes. Min 44px touch targets. Focus-visible rings (accent).
- Works one-handed. Readable while in pain (large, calm, low-glare). Reduced-motion honored everywhere.
