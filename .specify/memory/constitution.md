<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0 (New principle added)
Modified principles: None
Added sections:
  - Core Principles: IV. UI Framework (Tailwind CSS + shadcn/ui)
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ compatible (no UI-specific constraints)
  - .specify/templates/spec-template.md ✅ compatible (no UI framework references)
  - .specify/templates/tasks-template.md ✅ compatible (generic task structure)
Follow-up TODOs: None
-->

# Reflekt Constitution

## Core Principles

### I. Privacy-First

User privacy is a non-negotiable foundation of Reflekt. All architectural and feature decisions
MUST prioritize user data protection.

- All journal data MUST be encrypted at rest and in transit
- Local-first storage MUST be the default; cloud sync is opt-in only
- No telemetry or analytics may be collected without explicit user consent
- Third-party services MUST NOT receive user journal content
- AI processing SHOULD occur locally where feasible; when cloud AI is required, data MUST be
  anonymized or user MUST explicitly consent to transmission
- Data deletion requests MUST be honored completely within 24 hours

**Rationale**: Personal journaling contains intimate thoughts and feelings. Users will not trust
an AI journaling app that compromises their privacy. Privacy-first design builds trust and
differentiates Reflekt from data-harvesting alternatives.

### II. Test-Driven Development

All feature implementation MUST follow TDD methodology. This principle is strictly enforced.

- Tests MUST be written before implementation code
- Tests MUST fail before implementation begins (Red phase)
- Implementation MUST be minimal to pass tests (Green phase)
- Refactoring MUST NOT change test outcomes (Refactor phase)
- Pull requests without corresponding tests for new functionality MUST be rejected
- Test coverage for critical paths (encryption, data handling, AI integration) MUST exceed 90%

**Rationale**: TDD ensures code correctness, documents expected behavior, and prevents
regressions. For a privacy-focused app handling sensitive user data, comprehensive testing
is essential to maintain user trust.

### III. Simplicity (YAGNI)

Start simple. Build only what is needed now. Avoid premature abstraction and optimization.

- New features MUST solve a current, validated user need—not hypothetical future requirements
- Abstractions MUST NOT be introduced until at least three concrete use cases exist
- Dependencies MUST be justified; prefer standard library over third-party packages
- Configuration options MUST be minimal; sensible defaults over excessive configurability
- Code complexity MUST be justified in PR descriptions when unavoidable
- "We might need this later" is NOT a valid justification for added complexity

**Rationale**: Complexity is the enemy of maintainability and security. Every abstraction,
dependency, and configuration option is a potential source of bugs and attack surface.
Simplicity enables faster iteration and easier security audits.

### IV. UI Framework (Tailwind CSS + shadcn/ui)

All user interface development MUST use Tailwind CSS for styling and shadcn/ui for components.

- All styling MUST use Tailwind CSS utility classes; custom CSS is prohibited except for:
  - CSS variables (design tokens for theming)
  - Animations that cannot be expressed via Tailwind
  - Third-party library overrides (documented in component file)
- All interactive components MUST use [shadcn/ui](https://ui.shadcn.com/) primitives
- Custom components MUST extend shadcn/ui patterns and follow their composition model
- New component additions from shadcn/ui MUST be installed via the CLI (`npx shadcn@latest add`)
- Component styling MUST NOT use inline `style` attributes
- Design tokens (colors, spacing, typography) MUST be defined in `tailwind.config.js`
- Dark mode MUST be supported using Tailwind's `dark:` variant

**Rationale**: A unified UI framework ensures visual consistency, accelerates development,
and reduces decision fatigue. Tailwind's utility-first approach aligns with Simplicity (III)
by avoiding premature abstractions. shadcn/ui provides accessible, well-tested components
that can be customized without lock-in.

## Development Workflow

All contributors MUST follow this workflow:

1. **Specification**: Features begin with a clear spec document in `/specs/`
2. **Planning**: Implementation plans MUST pass Constitution Check before coding
3. **TDD Cycle**: Write failing test → Implement → Refactor (repeat)
4. **Review**: All changes require PR review with constitution compliance verification
5. **Documentation**: User-facing changes MUST update relevant documentation

## Quality Standards

- TypeScript strict mode MUST be enabled; no `any` types without documented justification
- All user-facing errors MUST be actionable and privacy-respecting (no internal details leaked)
- Performance: Journal operations MUST complete within 200ms on standard hardware
- Accessibility: UI MUST meet WCAG 2.1 AA standards

## Governance

This constitution supersedes all other development practices and guidelines. Amendments require:

1. Written proposal with rationale
2. Review period of at least 48 hours
3. Documented approval from project maintainers
4. Migration plan for any breaking changes to existing code
5. Version increment following semantic versioning:
   - MAJOR: Principle removal or fundamental redefinition
   - MINOR: New principle or substantial guidance expansion
   - PATCH: Clarifications, typo fixes, non-semantic changes

All pull requests and code reviews MUST verify compliance with this constitution.
Complexity beyond the simplest solution MUST be explicitly justified.

**Version**: 1.1.0 | **Ratified**: 2026-01-16 | **Last Amended**: 2026-01-18
