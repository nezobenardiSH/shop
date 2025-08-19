# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Lean AIbasekit - a structured framework for rapidly developing software projects using AI assistance. The repository contains custom Claude Code commands that create a systematic workflow from idea to implementation.

## Custom Commands Workflow

This project uses a three-stage development workflow:

1. **`/start`** - Project idea gathering and clarification
   - Conducts adaptive questioning to understand requirements
   - Outputs: `docs/idea-summary.md`

2. **`/prp-generator`** - Project Requirements Plan generation
   - Creates technical requirements from idea summary
   - Reads: `docs/idea-summary.md`
   - Outputs: `docs/prp.md`

3. **`/implementation`** - Implementation plan creation
   - Breaks PRP into micro-tasks with test cases
   - Reads: `docs/prp.md`
   - Outputs: `docs/implementation-plan.md`

## Development Principles

### Micro-Task Implementation
- Tasks are limited to 10-15 lines of code maximum
- Each batch contains 2-3 tasks to manage context window
- Total project scope: 8-12 micro-tasks

### Testing Philosophy
- Manual testing after EVERY task completion
- Specific test commands and expected outputs provided
- Stop and fix if any test fails before proceeding

### Document Updates
- After each batch completion, update `docs/implementation-plan.md` with:
  - Actual implementation details
  - Test results
  - Files created/modified
  - Completion timestamp

## Project Structure

```
lean_AIbasekit/
├── .claude/
│   └── commands/
│       ├── start.md           # Idea gathering command
│       ├── prp-generator.md   # PRP creation command
│       └── implementation.md  # Implementation plan command
└── docs/                      # Generated documentation
    ├── idea-summary.md       # Project idea summary
    ├── prp.md               # Project Requirements Plan
    └── implementation-plan.md # Micro-task implementation plan
```

## Key Implementation Guidelines

### Code Quality Requirements
- Verbose, readable code over compact solutions
- Maximum 15 lines per function
- Descriptive variable names
- Comments explaining business logic
- No nested ternary operators
- Separate files for different concerns

### Conversation Management
- Start fresh conversation for each batch
- Always provide PRP context when starting
- Reference completed work from previous batches
- Use provided conversation templates in implementation plan

## Working with This Repository

When implementing a project:
1. Always read the current `docs/implementation-plan.md` first
2. Check task status indicators (⬜ Not Started, 🟦 In Progress, ✅ Complete)
3. Implement tasks in order within each batch
4. Run manual tests after each task
5. Update documentation after batch completion

## Important Notes

- This is a skeleton-first approach - focus on MVP functionality
- No automated testing in initial implementation
- Each batch should be completed in a single conversation session
- If context window becomes an issue, start a fresh conversation using the provided templates