import Client from "./Client";

export type RoutePageProps = {
  params?: Promise<{path?: string[]}>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RoutePage({admin = false, params, searchParams}: RoutePageProps & {admin?: boolean}) {
  const [route, query] = await Promise.all([params, searchParams]);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      search.append(key, entry);
    }
  }
  const pathname = "/" + (route?.path || []).map(encodeURIComponent).join("/");
  return <Client admin={admin} initialLocation={pathname + (search.size ? "?" + search : "")} />;
}
