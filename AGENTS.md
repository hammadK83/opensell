# Project work tracking

- Follow the existing `type (scope): Description` style with lowercase detail bullets for commit messaged. scope should be one of `backend`, `mobile`, `shared` or a combination. If none of those fit, come up with an appropriate one. Always draft commit and seek approval before committing.

## Product vision and implementation requirements

OpenSell is a location-first, offline-first marketplace for physical products and local services.

Core requirements:

- Unified Product and Service listing architecture.
- Geographic discovery with user location privacy.
- Durable offline storage and synchronization.
- Secure buyer-seller messaging in the first release.
- Strict resource quotas and infrastructure cost controls.
- Maintainable, scalable architecture with automated testing.

The authoritative product specification is:
`docs/OpenSellImplementationPlan.md`

### Working with the specification

- For feature-level work, locate and read the relevant feature section, its dependencies, and applicable cross-cutting requirements.
- Do not read or summarize the entire specification unless the task requires a project-wide architectural decision.
- Implement features in dependency order unless explicitly instructed otherwise.
- Do not implement deferred features as part of an unrelated task.
- Preserve existing functionality and established architecture.
- Flag discrepancies between implementation and specification before making architectural changes.
- Run relevant tests and checks before considering a feature complete.

### Using Skills

- For Expo and React Native tasks, consult the relevant installed Expo skills. Follow the project's existing architecture and dependencies, avoid unnecessary new libraries, and run relevant type checks and tests after implementation.
