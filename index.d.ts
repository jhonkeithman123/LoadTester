export interface RouteConfig {
  id: string;
  name: string;
  path: string;
  weight: number;
  isJson?: boolean;
  checkKeywords?: string[];
}

export interface ProjectProfile {
  targetDir: string;
  framework: "nextjs" | "vite" | "astro" | "express-or-api" | "generic";
  name: string;
  localPort: number;
  liveUrl: string;
  isMonorepo: boolean;
  routes: RouteConfig[];
  packageJsonPath: string | null;
  hasGitignore: boolean;
}

export interface GlossaryTerm {
  category: string;
  term: string;
  shortName: string;
  description: string;
  formula?: string;
  benchmark?: string;
  troubleshooting?: string;
}

export function detectProject(targetDir?: string): ProjectProfile;
export function discoverRoutes(targetDir: string, framework: string): RouteConfig[];
export function generateLoadTesterScript(profile: ProjectProfile): string;
export function updateTargetPackageJson(profile: ProjectProfile): boolean;
export function updateTargetGitignore(targetDir: string): boolean;
export function generateGlossaryHtml(): string;

export const GLOSSARY_TERMS: GlossaryTerm[];
