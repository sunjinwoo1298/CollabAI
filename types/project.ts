export interface Project {
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
  isOwner: boolean;
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
