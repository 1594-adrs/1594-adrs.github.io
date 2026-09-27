export interface Profile {
  name: string;
  shortName: string;
  title: string;
  level: string;
  tagline: string;
  description: string;
  role: string;
  resumeUrl?: string;
  email: string;
  location: string;
  timezone: string;
  /** One-line availability shown in the hero and contact section. */
  availability: string;
}

export interface NavLink {
  label: string;
  href: string;
  id: string;
  isButton?: boolean;
}

export interface SocialNetwork {
  iconName: string;
  url: string;
  label: string;
}

export interface SkillCategory {
  title: string;
  skills: string[];
}

export interface Course {
  name: string;
  issuer?: string;
  year?: string;
  url?: string;
}

export interface ExperienceLink {
  label: string;
  url: string;
}

export interface ExperienceItem {
  role: string;
  organization: string;
  location?: string;
  period: string;
  summary?: string;
  highlights: string[];
  tech: string[];
  link?: ExperienceLink;
}

export interface Education {
  degree: string;
  institution: string;
  period: string;
  detail: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  githubUrl: string;
  imageUrl?: string;
  imageAlt?: string;
  liveUrl?: string;
  featured?: boolean;
}

export interface WebProject {
  id: string;
  title: string;
  description: string;
  route: string;
  technologies: string[];
  iconName: string;
}

export interface SiteInfo {
  /** Absolute origin without trailing slash, e.g. https://example.github.io */
  url: string;
  siteName: string;
  /** Path of the 1200x630 social preview image. */
  ogImage: string;
  locale: string;
}

export interface PageMeta {
  title: string;
  description: string;
  /** Canonical path with trailing slash, e.g. '/' or '/web-projects/'. */
  path: string;
  /** Set to true for pages that must not be indexed (404). */
  noindex?: boolean;
}

export type PageKey = 'home' | 'webProjects' | 'calculator' | 'notFound';
