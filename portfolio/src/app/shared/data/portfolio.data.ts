import {
  Profile,
  NavLink,
  SocialNetwork,
  SkillCategory,
  Course,
  Education,
  Project,
  WebProject,
} from '../models/portfolio.models';

export const PROFILE: Profile = {
  name: 'Andrés David Rincón Salazar',
  shortName: 'Andrés Rincón',
  title: 'Software Developer',
  level: 'Full Stack',
  role: 'Software Developer · Full Stack',
  tagline: 'I build software end to end — from the data layer to the interface — and ship it.',
  description: `Computer Science student at UTP building full-stack projects end to end: a chess engine in Racket, a file-based DBMS in C, a curriculum-planning tool in Python, and web apps in Angular and TypeScript. I write clean, tested code, pick up new stacks fast, and I'm sharpening problem-solving through competitive programming. Certified in AI and prompt engineering.`,
  resumeUrl: '/Andres_Rincon_CV.pdf',
};

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '#home', id: 'home' },
  { label: 'About Me', href: '#about', id: 'about' },
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
    title: 'Advanced',
    skills: ['Python', 'C', 'Racket'],
  },
  {
    title: 'Functional',
    skills: ['Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'LUA'],
  },
  {
    title: 'Databases',
    skills: ['SQL'],
  },
  {
    title: 'Infrastructure',
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
    liveUrl: 'https://1594-adrs.github.io/',
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
