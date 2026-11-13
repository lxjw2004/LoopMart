"use client";
import { useState, type ReactNode } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { routeHref } from "../navigation";
import { useLayout } from "../shared/design";

const pages = ["overview", "users", "items", "rides", "conversations", "reports", "community-messages", "contact", "settings", "audit"];
const navigationMarks = pages.map((_, index) => function NavigationMark() {
  return <Text type="admin-nav-index" aria-hidden="true" hasTabularNumbers>{String(index + 1).padStart(2, "0")}</Text>;
});
const names: Record<string, [string, string]> = { login: ["账户", "Account"], overview: ["总览", "Overview"], users: ["用户", "Users"], items: ["商品", "Items"], rides: ["拼车", "Rides"], conversations: ["会话", "Conversations"], reports: ["举报", "Reports"], "community-messages": ["社区消息", "Community messages"], contact: ["联系表单", "Contact"], settings: ["设置", "Settings"], audit: ["审计日志", "Audit log"] };
export interface AdminShellProps { children: ReactNode; page: string; onNavigate: (page: string) => void; me?: { name?: string; role?: string } | null; english?: boolean; onLanguageChange?: () => void; onLogout?: () => void; t?: (key: string) => string }

export default function AdminShell({ children, page, onNavigate, me, english = false, onLanguageChange, onLogout, t }: AdminShellProps) {
  const [expanded, setExpanded] = useState(false);
  const { mobile } = useLayout();
  const label = (key: string) => t?.(key) || names[key]?.[english ? 1 : 0] || key;
  const navigationLabel = english ? "Administration" : "管理导航";
  const brand = <Token color="admin-brand" size="sm" label="Admin" />;

  return (
    <AppShell
      height="auto"
      variant="section"
      className="admin-shell"
      contentPadding={0}
      mobileNav={{ hasToggle: true, isOpen: expanded, onOpenChange: setExpanded }}
      topNav={<TopNav label={english ? "Application navigation" : "应用导航"} style={{ minHeight: "calc(var(--size-element-md) + var(--spacing-4))" }} heading={<TopNavHeading heading="LoopMart" headingHref={routeHref("overview", true)} headerEndContent={brand} />} />}
      sideNav={
        <SideNav
          aria-label={navigationLabel}
          className="admin-sidebar"
          style={{ width: "var(--lm-admin-sidebar-width)", maxWidth: "100%" }}
          header={<VStack style={{ paddingBlockStart: mobile ? 0 : "var(--spacing-5)", paddingBlockEnd: "var(--spacing-4)", paddingInline: "var(--spacing-3)" }}><SideNavHeading className="admin-brand" style={{ minHeight: "calc(var(--spacing-8) + var(--border-width))" }} heading="LoopMart" headingHref={routeHref("overview", true)} headerEndContent={brand} /></VStack>}
          footer={
            <VStack gap={5}><Divider /><HStack gap={2} wrap="wrap" vAlign="center" data-testid="admin-account">
              <Avatar name={me?.name || "LoopMart"} size="sm" tooltip={false} />
              <Text type="supporting">{me?.name || (english ? "Not signed in" : "未登录")}</Text>
              {me && onLogout && <Button variant="ghost" size="sm" width="fit-content" label={english ? "Sign out" : "退出"} onClick={onLogout} />}
            </HStack></VStack>
          }
        >
          <SideNavSection title={navigationLabel} isHeaderHidden style={{ paddingInline: "var(--spacing-2)" }}>
            {pages.map((key, index) => (
              <SideNavItem
                key={key}
                label={label(key)}
                icon={navigationMarks[index]}
                style={{ minHeight: mobile ? "var(--size-element-md)" : "calc(var(--spacing-10) - var(--border-width))", paddingInline: "var(--spacing-3)", marginBlockEnd: "var(--spacing-0-5)" }}
                href={routeHref(key, true)}
                isSelected={page === key}
                onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(key); setExpanded(false); } }}
              />
            ))}
          </SideNavSection>
        </SideNav>
      }
    >
      <TopNav
        label={english ? "Account navigation" : "账户导航"}
        className="admin-topbar"
        heading={<Text type="supporting">{label(page)}</Text>}
        style={{ height: "var(--lm-admin-topbar-height)", paddingInline: "var(--lm-admin-gutter)" }}
        endContent={onLanguageChange && <Button variant="ghost" size="sm" width="fit-content" label={english ? "中文" : "EN"} onClick={onLanguageChange} />}
      />
      <VStack
        width="100%"
        maxWidth="var(--lm-admin-page-max)"
        style={{ minWidth: 0, marginInline: "auto", paddingInline: "var(--lm-admin-gutter)", paddingBlockStart: "var(--lm-admin-page-top)", paddingBlockEnd: "var(--lm-admin-page-bottom)" }}
      >{children}</VStack>
    </AppShell>
  );
}
