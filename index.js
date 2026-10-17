/**
 * LoadTester Kit — Programmatic API
 * Universal load testing suite generator for any architecture
 */

const {
  detectProject,
  discoverRoutes,
  loadCustomConfig,
  inspectDirectoryService,
  scanWorkspaceServices
} = require("./lib/detector");

const {
  generateLoadTesterScript,
  generateSingleServiceScript,
  generateMultiServiceScript
} = require("./lib/generator");

const { updateTargetPackageJson, updateTargetGitignore } = require("./lib/updater");
const { GLOSSARY_TERMS } = require("./lib/glossary");
const { generateGlossaryHtml } = require("./lib/reporter-template");

module.exports = {
  detectProject,
  discoverRoutes,
  loadCustomConfig,
  inspectDirectoryService,
  scanWorkspaceServices,
  generateLoadTesterScript,
  generateSingleServiceScript,
  generateMultiServiceScript,
  updateTargetPackageJson,
  updateTargetGitignore,
  GLOSSARY_TERMS,
  generateGlossaryHtml,
};
