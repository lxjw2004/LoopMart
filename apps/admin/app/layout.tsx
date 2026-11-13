import DesignSystem from "../../../packages/ui/src/DesignSystem";
export const metadata = { title: "LoopMart" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" style={{ scrollbarGutter: "stable" }}>
      <body><DesignSystem admin>{children}</DesignSystem></body>
    </html>
  );
}
