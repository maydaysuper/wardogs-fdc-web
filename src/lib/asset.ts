/** Prefix static files with Vite `base` so GitHub Pages and local preview both resolve. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const clean = path.replace(/^\/+/, "");
  return `${base.endsWith("/") ? base : `${base}/`}${clean}`;
}
