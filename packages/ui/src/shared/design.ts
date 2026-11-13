"use client";

import { useMediaQuery } from "@astryxdesign/core";
import { widthBreakpoints } from "../../../../src/themes/breakpoints.js";

export { widthBreakpoints };

export function useLayout() {
  const mobile = useMediaQuery(`(width < ${widthBreakpoints.md}px)`);
  const desktop = useMediaQuery(`(width >= ${widthBreakpoints.xl}px)`);
  return { mobile, tablet: !mobile && !desktop, desktop };
}
