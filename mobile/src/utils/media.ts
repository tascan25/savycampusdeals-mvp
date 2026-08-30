import { env } from "@/config/env";

/**
 * Public outlet/avatar assets are mounted read-only at /images by FastAPI, so
 * native clients only need the API host running. Other legacy relative paths
 * still fall back to the website origin. Absolute and data: URIs pass through.
 */
export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^(https?:|data:)/i.test(path)) return path;
  if (/^(?:\/)?images\//i.test(path)) {
    return `${env.API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  }
  return `${env.WEB_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
