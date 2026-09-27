import {
  Profile,
  NavLink,
  SocialNetwork,
  SkillCategory,
  Course,
  Education,
  Project,
  WebProject,
  ExperienceItem,
} from '../models/portfolio.models';

export const PROFILE: Profile = {
  name: 'Andrés David Rincón Salazar',
  shortName: 'Andrés Rincón',
  title: 'Software Developer',
  level: 'Full Stack',
  role: 'Software Developer · Full Stack',
  tagline: 'I build software end to end — from the data layer to the interface — and ship it.',
  description: `Junior full stack developer working with Angular, NestJS and TypeScript. Systems and Computer Engineering student at Universidad Tecnológica de Pereira, where I also work as a software development and support monitor. I build practical tools end to end — like this site's graphing calculator — and pick up new stacks fast.`,
  resumeUrl: '/Andres_Rincon_CV.pdf',
};

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '#home', id: 'home' },
  { label: 'About Me', href: '#about', id: 'about' },
  { label: 'Experience', href: '#experience', id: 'experience' },
  { label: 'Projects', href: '#projects', id: 'projects' },
  { label: 'download_cv', href: '/Andres_Rincon_CV.pdf', id: 'cv', isButton: true },
];

export const SOCIAL_NETWORKS: SocialNetwork[] = [
  {
    iconName: 'github',
    url: 'https://github.com/1594-adrs',
    label: 'GitHub',
  },
  {
    iconName: 'linkedin',
    url: 'https://www.linkedin.com/in/1594-adrs/',
    label: 'LinkedIn',
  },
  {
    iconName: 'envelope',
    url: 'mailto:andresdrincons2007@gmail.com',
    label: 'Email',
  },
];

export const SKILLS: SkillCategory[] = [
  {
    title: 'Frontend',
    skills: ['Angular', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Astro'],
  },
  {
    title: 'Backend',
    skills: ['NestJS', 'Node.js', 'REST APIs', 'JWT / OAuth'],
  },
  {
    title: 'Databases',
    skills: ['PostgreSQL', 'Oracle', 'SQL'],
  },
  {
    title: 'Languages & Mobile',
    skills: ['Python', 'C', 'Racket', 'Dart / Flutter'],
  },
  {
    title: 'Tools & Practices',
    skills: ['Git', 'GitHub', 'GitLab CI/CD', 'Scrum', 'Cloud VMs (basic)'],
  },
];

export const COURSES: Course[] = [
  { name: 'Python Developer' },
  { name: 'Generative AI Usage' },
  { name: 'Prompt Engineering' },
  { name: 'Data Analysis with AI' },
  { name: 'Professional Ethics' },
  { name: 'Interpersonal Skills Development' },
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

export const EXPERIENCE: ExperienceItem[] = [
  {
    role: 'Software Development & Support Monitor',
    organization: 'Universidad Tecnológica de Pereira',
    location: 'Pereira, Colombia',
    period: 'Feb 2026 – Present',
    summary: 'Part-time contract. Internal systems are confidential.',
    highlights: [
      'Develop and maintain internal web applications with Angular and NestJS on Oracle and PostgreSQL, working in Scrum teams with Git workflows and CI/CD pipelines.',
      "Contributed to the UI refactor of UTP Móvil, the university's Flutter mobile app.",
    ],
    tech: ['Angular', 'NestJS', 'Oracle', 'PostgreSQL', 'Flutter', 'Git', 'CI/CD'],
  },
  {
    role: 'Freelance Web Developer',
    organization: 'AF Autoservice',
    period: '2026',
    highlights: [
      "Designed, built and deployed the website of a mobile auto-repair business in Colombia's Coffee Region using Astro, with on-page SEO and Vercel hosting; client reported positive results.",
    ],
    tech: ['Astro', 'SEO', 'Vercel'],
    link: { label: 'Live site', url: 'https://af-autoservice.vercel.app/' },
  },
];

export const SOFT_SKILLS: string[] = [
  'Spanish (native) · English (B2 reading and writing)',
  'Collaboration and clear communication across dev teams',
  'Breaking down complex problems into clean, working code',
  'Autodidact who picks up new stacks fast',
];

export const PROJECTS: Project[] = [
  {
    id: '1',
    title: 'RacketChess',
    description:
      "A chess engine written entirely in Racket \u2014 pure recursion for move validation, check, and checkmate detection, with a graphical interface built on Racket's own graphics library.",
    technologies: ['Racket', 'Lisp', 'Functional Programming', 'Game Logic'],
    githubUrl: 'https://github.com/1594-adrs/RacketChess',
    featured: true,
  },
  {
    id: '2',
    title: 'CSV2Binary-DBMS',
    description:
      'A file-based database engine in C that converts CSV data into binary records and answers analytical queries \u2014 sorting, binary search, currency conversion \u2014 without ever loading the full dataset into memory.',
    technologies: ['C', 'File I/O', 'Binary Search', 'Merge Sort'],
    githubUrl: 'https://github.com/1594-adrs/CSV2Binary-DBMS',
  },
  {
    id: '3',
    title: 'PrereqFlow',
    description:
      'An interactive Streamlit app that models a university curriculum as a prerequisite graph \u2014 visualize it, plan semesters under credit limits, edit courses live, and track progress, backed by 50 passing tests.',
    technologies: ['Python', 'Streamlit', 'PyVis', 'pytest'],
    githubUrl: 'https://github.com/1594-adrs/PrereqFlow',
  },
  {
    id: '4',
    title: 'Portfolio',
    description:
      'This site. Built with Angular 21, standalone components, and signals. Scroll-reveal animations, lazy-loaded routes, and a custom IntersectionObserver directive. Deployed on GitHub Pages.',
    technologies: ['Angular', 'TypeScript', 'CSS', 'HTML'],
    githubUrl: 'https://github.com/1594-adrs/1594-adrs.github.io',
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
    iconName: 'calculator',
  },
];
