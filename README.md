# Multinex Skill: Code Reviews 🛡️

[![NPM Version](https://img.shields.io/npm/v/@multinex/skill-code-reviews.svg)](https://npmjs.com/package/@multinex/skill-code-reviews)
[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](https://opensource.org/licenses/MIT)

**Expert AI agent configured to review code changes against the Multinex constitutional styling rules and security guidelines.**

This repository contains the official Multinex AI "Skill" configuration for the Code Review Agent. It is designed to be injected into an LLM's context window to instantly equip it with the ability to deeply evaluate pull requests and local changes.

## Quick Start

To equip your AI agent with this skill, simply instruct your LLM to read the `SKILL.md` file, or install the package:

```bash
npm install @multinex/skill-code-reviews
```

Then in your agent setup:
```typescript
import fs from 'fs';
import path from 'path';

// Load the skill instructions into the system prompt
const reviewSkill = fs.readFileSync(
  path.resolve('./node_modules/@multinex/skill-code-reviews/SKILL.md'), 
  'utf-8'
);

const systemPrompt = `You are an AI Agent. Adopt the following skill:\n\n${reviewSkill}`;
```

## LLM Inference (`llms.txt`)

This repository fully supports the `llms.txt` standard. LLMs can directly infer the capabilities of this skill by reading the [`llms.txt`](./llms.txt) file at the root of this repository.

## Features
- **Strict Typing Checks:** Rejects PRs that include `any` types.
- **Production Readiness:** Blocks unhandled placeholders and `// TODO` items.
- **Security Validation:** Ensures code respects Airlock and Realm constraints without logging secrets.

---
*Built with precision by the [Multinex AI](https://multinex.ai) Engineering Team.*

## PR Monitor workflow — 1.1.0 candidate

The reusable [pr-monitor skill](skills/pr-monitor/SKILL.md) handles feedback
verification, scoped fixes, CI, restacking, casual inline replies, conversation
resolution, fresh reviews, and merges when the invoking user authorizes them.
The original code-review skill remains available at the package root.

Install from this checkout (no registry release needed):

```sh
node skills/pr-monitor/scripts/cli.mjs install --into "$HOME/.agents/skills"
```

Reload the agent's skill discovery, then invoke:

```text
$pr-monitor owner/repo
$pr-monitor owner/repo status
$pr-monitor owner/repo watch for 30 minutes; merge approved PRs
```

The first invocation completes one sweep within the user's authorization. A
watch is bounded by its requested duration. The agent performs code changes and
GitHub mutations; the CLI itself only installs the skill or reads GitHub.
Installations are explicit and refuse existing files/directories. Back up an
existing installation before replacing it. There is no postinstall hook or
background daemon. Use any skill-capable client by selecting its skills directory.

For read-only inventory, with Node 20+ and `gh` authenticated for the repository:

```sh
node skills/pr-monitor/scripts/cli.mjs snapshot owner/repo --pr 15,16 --output /tmp/pr-snapshot-new.json
```

When this candidate is released, the same CLI is exposed through the package's
`pr-monitor` npm binary. This document does not claim 1.1.0 is already published.
The inventory omits discussion bodies; read the linked conversations to evaluate
findings. It fingerprints bodies to detect edits and reports CI evidence gaps,
ref movement, and reviewed-base uncertainty. It cannot certify merge readiness.
All connections are paginated; authentication/API failures never become an empty
successful inventory. Exit 2 means incomplete evidence; exit 1 means failure.
Output files are created exclusively with mode 0600. Errors omit GitHub stderr
so credentials or private response bodies do not leak through diagnostics.

Validation and packaging:

```sh
npm test
npm pack --dry-run
npm pack --pack-destination /tmp
```

The package has no runtime dependencies. Tests and release workflow files are
excluded from its explicit payload. Publishing remains a separate approved
release; the existing release workflow also runs the package tests.
