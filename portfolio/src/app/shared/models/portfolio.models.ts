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
