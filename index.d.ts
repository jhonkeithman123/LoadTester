export type ArchitectureType =
  | "monorepo"
  | "multi-service"
  | "single-service"
  | "containerized"
  | "custom";

export type WorkspaceType =
  | "turborepo"
  | "pnpm"
  | "npm-workspaces"
  | "yarn"
  | "bun"
  | "nx"
  | "lerna"
  | "polyglot"
  | "docker-compose"
  | "none";

export type ServiceLanguage =
  | "nodejs"
  | "python"
  | "go"
  | "rust"
  | "php"
  | "ruby"
  | "java"
  | "container"
  | "generic";

export interface RouteConfig {
  id: string;
  name: string;
  path: string;
  weight: number;
  isJson?: boolean;
  checkKeywords?: string[];
}

export interface ServiceProfile {
  id: string;
  name: string;
  path: string;
  fullPath: string;
  framework: string;
  language: ServiceLanguage;
  localPort: number;
  liveUrl: string;
  routes: RouteConfig[];
  packageJsonPath?: string | null;
}

export interface ProjectProfile {
  targetDir: string;
  architecture: ArchitectureType;
  workspaceType: WorkspaceType;
  framework: string;
  language: ServiceLanguage;
  name: string;
  localPort: number;
  liveUrl: string;
  isMonorepo: boolean;
  services: ServiceProfile[];
  selectedService?: ServiceProfile | null;
  routes: RouteConfig[];
  packageJsonPath: string | null;
  hasGitignore: boolean;
}

export interface LoadTesterOptions {
  app?: string;
  all?: boolean;
  port?: number;
  url?: string;
  force?: boolean;
}

export interface LoadTesterConfig {
  architecture?: ArchitectureType;
  services?: Array<{
    id?: string;
    name?: string;
    path?: string;
    framework?: string;
    language?: ServiceLanguage;
    port?: number;
    localPort?: number;
    liveUrl?: string;
    routes?: RouteConfig[];
  }>;
  stages?: Array<{ duration: string; target: number }>;
  thresholds?: Record<string, string[]>;
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

export function detectProject(targetDir?: string, options?: LoadTesterOptions): ProjectProfile;
export function discoverRoutes(targetDir: string, framework?: string, language?: string): RouteConfig[];
export function loadCustomConfig(targetDir: string): LoadTesterConfig | null;
export function inspectDirectoryService(serviceDir: string, rootDir: string): ServiceProfile;
export function scanWorkspaceServices(targetDir: string): ServiceProfile[];

export function generateLoadTesterScript(profile: ProjectProfile, options?: LoadTesterOptions): string;
export function generateSingleServiceScript(service: ServiceProfile, globalProfile?: Partial<ProjectProfile>): string;
export function generateMultiServiceScript(profile: ProjectProfile): string;

export function updateTargetPackageJson(profile: ProjectProfile, options?: LoadTesterOptions): boolean;
export function updateTargetGitignore(targetDir: string): boolean;
export function generateGlossaryHtml(): string;

export const GLOSSARY_TERMS: GlossaryTerm[];
