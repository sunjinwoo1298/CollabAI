export interface Project {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  updatedAt: string;
  createdAt?: string;
  isOwner?: boolean;
}

export function slugifyProjectName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function generateShortSuffix(length: number = 5): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateRoomId(name: string, suffix?: string): string {
  const baseSlug = slugifyProjectName(name) || "project";
  const s = suffix || generateShortSuffix(5);
  return `${baseSlug}-${s}`;
}

