// Minimal shell for the print route so the app's bottom nav / chrome never leaks
// into the printed page. lang="hi" nudges the browser toward an Indic-capable
// font for Devanagari/Hinglish notes. This is a nested layout under the root
// layout, so we render only what the print page needs — no <BottomNav>.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div lang="hi">{children}</div>;
}
