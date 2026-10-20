const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { version, sourceCommit } = require('../release.json');
const repository = process.env.GITHUB_REPOSITORY ?? 'Oromis/pf2e-flatten';
assert.match(version, /^\d+\.\d+\.\d+$/);
assert.match(sourceCommit, /^[a-f0-9]{40}$/);
assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);

const tag = `v${version}`;
const archive = `pf2e-flatten-${tag}.zip`;
const releaseURL = `https://github.com/${repository}/releases`;
const manifestURL = `${releaseURL}/latest/download/module.json`;
const readSource = file => execFileSync('git', ['show', `${sourceCommit}:${file}`], { cwd: root });
const manifest = JSON.parse(readSource('module.json').toString('utf8'));
assert.equal(manifest.id, 'pf2e-flatten');
assert.deepEqual(manifest.esmodules, ['bundle.js']);
assert.equal(manifest.compatibility.maximum, '14');

const output = path.join(root, 'dist');
const stage = path.join(output, 'module');
fs.mkdirSync(output, { recursive: true });
// A fresh staging directory prevents stale files from entering a release.
fs.mkdirSync(stage);
manifest.version = version;
manifest.title += ' (Unofficial v14 build)';
manifest.description = `Unofficial v14 compatibility build from ${repository}. ${manifest.description}`;
manifest.url = `https://github.com/${repository}`;
manifest.manifest = manifestURL;
manifest.download = `${releaseURL}/download/${tag}/${archive}`;
manifest.license = 'LICENSE';
manifest.changelog = `${releaseURL}/tag/${tag}`;
const manifestJSON = `${JSON.stringify(manifest, null, 2)}\n`;
fs.writeFileSync(path.join(stage, 'module.json'), manifestJSON);
fs.writeFileSync(path.join(output, 'module.json'), manifestJSON);

const languageFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', sourceCommit, '--', 'lang'], {
  cwd: root, encoding: 'utf8'
}).trim().split('\n').filter(Boolean);
for (const file of ['bundle.js', 'LICENSE', ...languageFiles]) {
  assert.ok(!file.includes('..') && !path.isAbsolute(file), `Unsafe package path: ${file}`);
  const target = path.join(stage, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, readSource(file));
}
for (const language of manifest.languages) {
  assert.ok(languageFiles.includes(language.path), `Missing language file: ${language.path}`);
  JSON.parse(fs.readFileSync(path.join(stage, language.path), 'utf8'));
}
execFileSync(process.execPath, ['--check', path.join(stage, 'bundle.js')]);

fs.writeFileSync(path.join(output, 'release-notes.md'), `# Unofficial Foundry v14 compatibility build

This release is maintained in the ${repository} fork. It is not an upstream maintainer release.

- Permit Foundry v14 and use its current actor context-menu API.
- Preserve the earlier menu implementation on Foundry v13 and below.
- Keep the existing module ID, settings, flattening mathematics, and modifier storage.
- Guard missing actors and stale menu actions.

Tested in Foundry 14.369 with PF2e 8.6.1. The v13 menu path passed a mocked regression check; a live v13 instance was not tested.

## Installation

Paste this manifest URL into Foundry Setup > Add-on Modules > Install Module:

${manifestURL}

The manifest and ZIP both identify the module as pf2e-flatten. If the upstream module is already installed, switching the installed package to this fork may require uninstalling that module and installing this manifest instead. Existing actor modifiers are stored on actors, not in this package.

To return to the official release later, reinstall using the upstream manifest URL. Automatic update checks from this fork consult this fork's manifest.

Source: https://github.com/${repository}/commit/${sourceCommit}

Upstream project: https://github.com/League-of-Foundry-Developers/pf2e-flatten

Related issue: https://github.com/League-of-Foundry-Developers/pf2e-flatten/issues/24

The original Apache 2.0 license is included in the package.
`);
console.log(JSON.stringify({ version, tag, sourceCommit, repository, archive, manifestURL, files: ['module.json', 'bundle.js', 'LICENSE', ...languageFiles] }, null, 2));
