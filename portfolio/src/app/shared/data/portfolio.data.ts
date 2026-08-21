import {
  NavLink,
  SocialNetwork,
  SkillCategory,
  Course,
  Education,
  Project,
  WebProject,
} from '../models/portfolio.models';

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '#home', id: 'home' },
  { label: 'About Me', href: '#about', id: 'about' },
  { label: 'Projects', href: '#projects', id: 'projects' },
  { label: 'download_cv', href: '/Andres_Rincon_CV.pdf', id: 'cv', isButton: true },
];

export const SOCIAL_NETWORKS: SocialNetwork[] = [
  {
    icon: 'fab fa-github',
    url: 'https://github.com/1594-adrs',
    label: 'GitHub',
  },
  {
    icon: 'fab fa-linkedin',
    url: 'https://www.linkedin.com/in/1594-adrs/',
    label: 'LinkedIn',
  },
  {
    icon: 'fa-regular fa-envelope',
    url: 'mailto:andresdrincons2007@gmail.com',
    label: 'Email',
  },
];

export const SKILLS: SkillCategory[] = [
  {
    title: 'Advanced',
    icon: 'fas fa-code',
    skills: ['Python', 'C', 'Racket'],
  },
  {
    title: 'Functional',
    icon: 'fas fa-laptop-code',
    skills: ['Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'LUA'],
  },
  {
    title: 'Databases',
    icon: 'fas fa-database',
    skills: ['SQL'],
  },
  {
    title: 'Infrastructure',
    icon: 'fas fa-cloud',
    skills: ['Git', 'GitHub', 'AWS', 'Azure', 'Google Cloud'],
  },
];

export const COURSES: Course[] = [
  { name: 'Python Developer', issuer: 'Certification' },
  { name: 'Generative AI Usage', issuer: 'Certification' },
  { name: 'Prompt Engineering', issuer: 'Certification' },
  { name: 'Data Analysis with AI', issuer: 'Certification' },
  { name: 'Professional Ethics', issuer: 'Certification' },
  { name: 'Interpersonal Skills Development', issuer: 'Certification' },
];

export const EDUCATION: Education[] = [
  {
    degree: 'Computer Science and Systems Engineering',
    institution: 'Universidad Tecnologica De Pereira',
    period: '2025 - Present',
    detail: 'Active member of the competitive programming workshop',
  },
  {
    degree: 'Systems Technician',
    institution: 'SENA',
    period: '2023 - 2024',
    detail: 'Participant and winner of "Tecnoferia 2024: S.O.S-Tenibilidad"',
  },
];

export const SOFT_SKILLS: string[] = [
  'Bilingual: Spanish (Native), English (Advanced - B2)',
  'Collaboration and clear communication across dev teams',
  'Breaking down complex problems into clean, working code',
  'Autodidact who picks up new stacks fast',
];

export const PROJECTS: Project[] = [
  {
    id: '1',
    title: 'Portfolio',
    description:
      'This site. Built with Angular 21, standalone components, and signals. Scroll-reveal animations, lazy-loaded routes, and a custom IntersectionObserver directive. Deployed on GitHub Pages.',
    technologies: ['Angular', 'TypeScript', 'CSS', 'HTML'],
    githubUrl: 'https://github.com/1594-adrs/1594-adrs.github.io',
    featured: true,
  },
  {
    id: '2',
    title: 'RacketChess',
    description:
      "A chess engine written entirely in Racket. No imperative loops \u2014 pure recursion for move validation, check detection, and checkmate. Includes a graphical interface built with Racket's graphics library.",
    technologies: ['Racket', 'Lisp', 'Functional Programming', 'Game Logic'],
    githubUrl: 'https://github.com/1594-adrs/RacketChess',
    featured: true,
  },
  {
    id: '3',
    title: 'Discord Bots Automation',
    description:
      'A Python bot that executes Discord commands with human-like timing \u2014 typing indicators, random pauses, and realistic delays. Handles rate limits and errors gracefully.',
    technologies: ['Python', 'discord.py', 'Async/Await', 'API Integration'],
    githubUrl: 'https://github.com/1594-adrs/discord-bots-automation',
    featured: true,
  },
];

export const WEB_PROJECTS: WebProject[] = [
  {
    id: 'graphing-calculator',
    title: 'Graphing Calculator',
    description:
      'Plot functions, compute integrals, and visualize solids of revolution in real time.',
    route: '/web-projects/calculator',
    technologies: ['Angular', 'Canvas API', 'Custom Parser'],
    icon: 'fas fa-calculator',
  },
];
