import DesignSystem from "../../../packages/ui/src/DesignSystem";
export const metadata = { title: "LoopMart" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" style={{ scrollbarGutter: "stable" }}>
      {/* Browser extensions may add body attributes before React hydrates. */}
      <body suppressHydrationWarning><DesignSystem>{children}</DesignSystem></body>
    </html>
  );
}
