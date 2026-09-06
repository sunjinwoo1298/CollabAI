import { Project, slugifyProjectName } from "@/types/project";

export const INITIAL_OWNED_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Distributed Architecture",
    slug: slugifyProjectName("Distributed Architecture"),
    updatedAt: "2 hours ago",
    isOwner: true,
  },
  {
    id: "proj-2",
    name: "Auth & Gateway Pipeline",
    slug: slugifyProjectName("Auth & Gateway Pipeline"),
    updatedAt: "Yesterday",
    isOwner: true,
  },
  {
    id: "proj-3",
    name: "Payment Processing Engine",
    slug: slugifyProjectName("Payment Processing Engine"),
    updatedAt: "3 days ago",
    isOwner: true,
  },
];

export const INITIAL_SHARED_PROJECTS: Project[] = [
  {
    id: "proj-4",
    name: "Core Billing Service",
    slug: slugifyProjectName("Core Billing Service"),
    updatedAt: "1 day ago",
    isOwner: false,
  },
  {
    id: "proj-5",
    name: "Search Infrastructure",
    slug: slugifyProjectName("Search Infrastructure"),
    updatedAt: "4 days ago",
    isOwner: false,
  },
];
