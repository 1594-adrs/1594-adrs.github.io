import { NavLink, SocialNetwork, Project } from '../models/portfolio.models';

export interface SkillCategory {
  title: string;
  icon: string;
  skills: string[];
}

export interface Course {
  name: string;
  issuer: string;
  date?: string;
  url?: string;
}

export const navLinks: NavLink[] = [
  { label: 'About', href: '#about', id: 'about' },
  { label: 'Projects', href: '#projects', id: 'projects' },
];

export const socialNetworks: SocialNetwork[] = [
  {
    icon: 'ph ph-github-logo',
    url: 'https://github.com/1594-adrs',
    label: 'GitHub',
  },
  {
    icon: 'ph ph-linkedin-logo',
    url: 'https://www.linkedin.com/in/andr%C3%A9s-david-rinc%C3%B3n-salazar-a70928318/',
    label: 'LinkedIn',
  },
];

export const skills: SkillCategory[] = [
  {
    title: 'Advanced',
    icon: 'ph ph-code',
    skills: ['Python', 'C', 'Racket'],
  },
  {
    title: 'Functional',
    icon: 'ph ph-laptop',
    skills: ['Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'LUA'],
  },
  {
    title: 'Databases',
    icon: 'ph ph-database',
    skills: ['SQL'],
  },
  {
    title: 'Infrastructure',
    icon: 'ph ph-cloud',
    skills: ['Git', 'GitHub', 'AWS', 'Azure', 'Google Cloud'],
  },
];

export const courses: Course[] = [
  { name: 'Python Developer', issuer: 'Cisco Networking Academy', date: '2023' },
  { name: 'Generative AI Usage', issuer: 'IBM / Coursera', date: '2024' },
  { name: 'Prompt Engineering', issuer: 'DeepLearning.AI', date: '2024' },
  { name: 'Data Analysis with AI', issuer: 'Microsoft', date: '2023' },
  { name: 'Professional Ethics', issuer: 'SENA', date: '2023' },
  { name: 'Interpersonal Skills', issuer: 'SENA', date: '2023' },
];

export const education = [
  {
    degree: 'Computer Science and Systems Engineering',
    institution: 'Universidad Tecnológica De Pereira',
    period: '2025 - Present (Expected graduation 2029)',
    detail:
      'Active member of the competitive programming workshop, focusing on advanced algorithms and data structures.',
  },
  {
    degree: 'Systems Technician',
    institution: 'SENA',
    period: '2023 - 2024',
    detail:
      'Participant and winner of "Tecnoferia 2024: S.O.S-Tenibilidad", developing sustainable tech solutions.',
  },
];

export const softSkills = [
  'Bilingual Communication: Fluent in Spanish (Native) and English (B2), enabling seamless collaboration across international teams.',
  'Problem Solving: Demonstrated analytical approach by winning the Tecnoferia 2024 with a sustainable tech solution.',
  'Adaptability: Proven ability to quickly learn and apply new paradigms, from functional Racket to asynchronous Python automation.',
  'Autonomous Learning: Consistently upskilling through active participation in competitive programming and independent certifications.',
];

export const projects: Project[] = [
  {
    id: '1',
    title: 'RacketChess Engine',
    description:
      'Developed a fully functional chess game in pure Racket to demonstrate the power of functional programming without imperative loops. It features complete move validation, check/checkmate detection, and an interactive GUI built entirely with recursion-based algorithms. This project challenged conventional object-oriented game development approaches.',
    technologies: ['Racket', 'Lisp', 'Functional Programming', 'Algorithms'],
    githubUrl: 'https://github.com/1594-adrs/RacketChess',
    featured: true,
  },
  {
    id: '2',
    title: 'Discord Behavior Automation',
    description:
      'Engineered a command execution tool for Discord that simulates human-like behavior to bypass basic bot-detection mechanisms. Implemented realistic typing patterns, randomized break intervals, and advanced error handling strategies. The tool significantly reduced manual administrative overhead for server managers.',
    technologies: ['Python', 'discord.py', 'Async/Await', 'Automation'],
    githubUrl: 'https://github.com/1594-adrs/discord-bots-automation',
    featured: true,
  },
  {
    id: '3',
    title: 'Developer Portfolio',
    description:
      'Built a highly optimized, accessible, and responsive personal portfolio using Angular 21. Focused on modern web vitals, implementing semantic HTML, strict WCAG 2.2 accessibility standards, and performant scroll-reveal directives using IntersectionObserver without memory leaks.',
    technologies: ['Angular', 'TypeScript', 'CSS', 'Accessibility (a11y)'],
    githubUrl: 'https://github.com/1594-adrs/1594-adrs.github.io',
    featured: true,
  },
];

export const bioData = {
  name: 'Andrés Rincón',
  title: 'Software Developer',
  level: 'Mid-Level',
  description: `I build robust software solutions that solve real-world problems. Currently pursuing Computer Science at UTP, I specialize in both high-level web architecture and low-level algorithmic design. Whether I'm building functional chess engines in Racket, automating workflows in Python, or crafting accessible web experiences in Angular, I focus on writing clean, scalable, and maintainable code. Let's build something impactful together.`,
};
