export interface Profile {
  name: string;
  shortName: string;
  title: string;
  level: string;
  tagline: string;
  description: string;
  role: string;
  resumeUrl?: string;
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
  issuer: string;
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
