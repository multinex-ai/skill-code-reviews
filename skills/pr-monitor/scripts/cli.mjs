#!/usr/bin/env node
import { mkdirSync, copyFileSync, constants, existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GitHub } from './github.mjs';
import { snapshot } from './snapshot.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const help = `PR Monitor — agent workflow and read-only GitHub inventory

  pr-monitor snapshot owner/repo [--pr 15,16] [--output NEW_FILE]
  pr-monitor install --into SKILLS_DIRECTORY
  pr-monitor workflow

After installation, invoke $pr-monitor owner/repo in a skill-capable agent.
The CLI does not fix code, post replies, merge, or run a background watcher.
Use existing gh authentication; no token arguments are accepted.
Incomplete evidence exits 2. A new output file is written with mode 0600.
Installation creates SKILLS_DIRECTORY/pr-monitor and refuses existing paths.`;

/** @feature PRMonitor @breadcrumb 3 @obsidian_tag #PRMonitor @obsidian_color cyan
 * Explicit installation preserves existing client skills; no postinstall activation.
 */
export function install(into) {
  const parent = resolve(into), target = join(parent, 'pr-monitor');
  let existing = parent;
  const suffix = [];
  while (!existsSync(existing)) { suffix.unshift(existing.split('/').pop()); existing = dirname(existing); }
  const canonicalTarget = join(realpathSync(existing), ...suffix, 'pr-monitor');
  const within = relative(realpathSync(source), canonicalTarget);
  if (!within || (!within.startsWith('..') && !isAbsolute(within))) throw new Error('Cannot install inside the source skill');
  mkdirSync(parent, {recursive: true});
  mkdirSync(target, {mode: 0o700}); // Exclusive: existing directories/symlinks fail.
  function copy(from, to) {
    for (const entry of readdirSync(from, {withFileTypes: true})) {
      const input = join(from, entry.name), output = join(to, entry.name);
      if (entry.isDirectory()) { mkdirSync(output); copy(input, output); }
      else if (entry.isFile()) copyFileSync(input, output, constants.COPYFILE_EXCL);
      else throw new Error('Skill payload must contain only regular files/directories');
    }
  }
  copy(source, target);
  return target;
}
export function main(args) {
  const [command, ...rest] = args;
  if (!command || command === '--help' || command === 'help') { console.log(help); return 0; }
  if (command === 'workflow' && !rest.length) { console.log(readFileSync(join(source, 'SKILL.md'), 'utf8')); return 0; }
  if (command === 'install' && rest.length === 2 && rest[0] === '--into' && rest[1]) {
    console.log(`Installed ${install(rest[1])}. Reload your agent's skill discovery.`); return 0;
  }
  if (command !== 'snapshot' || !rest.length) throw new Error('Invalid command; use --help');
  const [repo, ...options] = rest;
  let numbers = [], output;
  const seen = new Set();
  for (let i = 0; i < options.length; i += 2) {
    const key = options[i], value = options[i + 1];
    if (!value || seen.has(key)) throw new Error('Missing or duplicate option');
    seen.add(key);
    if (key === '--pr' && /^[1-9]\d*(,[1-9]\d*)*$/.test(value)) {
      numbers = [...new Set(value.split(',').map(Number))];
      if (numbers.some(n => !Number.isSafeInteger(n))) throw new Error('Invalid PR number');
    } else if (key === '--output') output = resolve(value);
    else throw new Error('Unknown option or invalid value');
  }
  if (output && existsSync(output)) throw new Error('Output already exists; choose a new evidence file');
  const result = snapshot(new GitHub(), repo, numbers), text = JSON.stringify(result, null, 2) + '\n';
  if (output) { writeFileSync(output, text, {flag: 'wx', mode: 0o600}); console.log(`Saved snapshot: ${output}`); }
  else console.log(text);
  return result.complete ? 0 : 2;
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : 'PR monitor failed'); process.exitCode = 1; }
}
