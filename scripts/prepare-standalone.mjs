import { cp, mkdir, access } from "node:fs/promises";
for (const app of ["web", "admin"]) {
  const base = `apps/${app}/.next/standalone/apps/${app}`;
  await mkdir(`${base}/.next`, { recursive: true });
  await cp(`apps/${app}/.next/static`, `${base}/.next/static`, {
    recursive: true,
  });
  try {
    await access(`apps/${app}/public`);
    await cp(`apps/${app}/public`, `${base}/public`, { recursive: true });
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
console.log("Standalone static assets prepared.");
