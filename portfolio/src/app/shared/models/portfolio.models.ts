export interface NavLink {
  label: string;
  href: string;
  id: string;
  isButton?: boolean;
}

export interface SocialNetwork {
  icon: string;
  url: string;
  label: string;
}

export interface SkillCategory {
  title: string;
  icon: string;
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
  icon: string;
}
