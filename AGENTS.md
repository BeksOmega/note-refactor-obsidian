# Project Agents.md Guide

This Agents.md file provides comprehensive guidance for AI agents working with this codebase.

## Project Structure

- `/src`: Contains the source code of the Obsidian plugin.
  - `main.ts`: The main entry point for the plugin.
  - `settings.ts`: Handles plugin settings.
  - `settings-tab.ts`: Provides the UI for plugin settings.
- `/tests`: Contains test files for the plugin.
  - Utilizes Jest for testing.
- `/.github/workflows`: Contains GitHub Actions workflows.
  - `test.yml`: Defines the CI testing process.
  - `release.yml`: Defines the release process.
- `manifest.json`: Contains metadata about the plugin.
- `package.json`: Defines project dependencies and scripts.
- `rollup.config.js`: Configuration for Rollup, the module bundler.
- `tsconfig.json`: Configuration for TypeScript.

## Coding Conventions

### General Conventions

- The project uses TypeScript.
- Follow the existing code style in each file.
- Use meaningful variable and function names.
- Add comments for complex logic.
- Manage dependencies and run scripts using `npm`.

## Testing Requirements

Run tests with the following commands:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run coverage
```

## Commit/Submit Guidelines

When creating a commit or submitting changes, please ensure it:

1. Follows the Code of Conduct.
2. Includes tests, especially for significant changes or additions.
3. Includes updates to `README.md` if there are changes to plugin configuration, commands, or installation instructions.
4. The repository maintainer will handle version number updates.
5. Uses [Conventional Commits](https://www.conventionalcommits.org/) format for commit messages.
6. The commit message should summarize the entire task completed up to the point of the commit.

## Programmatic Checks

Before submitting changes, ensure the following commands run successfully:

```bash
# Build the project
npm run build
```
