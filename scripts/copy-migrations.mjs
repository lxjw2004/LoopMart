import { cp, mkdir } from "node:fs/promises";
await mkdir("dist/packages/database/migrations", { recursive: true });
await cp("packages/database/migrations", "dist/packages/database/migrations", {
  recursive: true,
});
