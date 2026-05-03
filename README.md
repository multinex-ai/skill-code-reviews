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