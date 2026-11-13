"use client";

import { Theme } from "@astryxdesign/core/theme";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import { loopmartWebTheme } from "../../../src/themes/loopmart-web/loopmart-web.js";
import { loopmartAdminTheme } from "../../../src/themes/loopmart-admin/loopmart-admin.js";
import "../../../src/themes/loopmart-web/loopmart-web.css";
import "../../../src/themes/loopmart-admin/loopmart-admin.css";

export default function DesignSystem({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  return <Theme theme={admin ? loopmartAdminTheme : loopmartWebTheme} mode="light">{children}</Theme>;
}
