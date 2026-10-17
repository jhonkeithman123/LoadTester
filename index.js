/**
 * LoadTester Kit — Programmatic API
 */

const { detectProject, discoverRoutes } = require("./lib/detector");
const { generateLoadTesterScript } = require("./lib/generator");
const { updateTargetPackageJson, updateTargetGitignore } = require("./lib/updater");
const { GLOSSARY_TERMS } = require("./lib/glossary");
const { generateGlossaryHtml } = require("./lib/reporter-template");

module.exports = {
  detectProject,
  discoverRoutes,
  generateLoadTesterScript,
  updateTargetPackageJson,
  updateTargetGitignore,
  GLOSSARY_TERMS,
  generateGlossaryHtml,
};
