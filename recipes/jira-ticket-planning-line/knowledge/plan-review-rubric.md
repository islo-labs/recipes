# Implementation plan review rubric

Approve only when the newest plan can be executed by an engineer with no
hidden conversation context.

- Steps are ordered, concrete, and identify the behavior being changed.
- Named files, modules, functions, schemas, APIs, and interfaces were verified
  against read-only repository evidence; uncertain guesses are called out.
- Testing names the relevant automated tests and decisive manual or operational
  checks, including failure behavior where appropriate.
- Cross-repository, service, schema, release, and ownership dependencies are
  explicit and correctly ordered.
- Rollout and rollback are proportionate to risk. A justified “not applicable”
  is acceptable for changes with no deploy or migration risk.
- The approach is technically feasible and does not contradict current code.
- Product, security, migration, compatibility, or ownership choices that an
  agent cannot safely resolve are sent to a human.
- For an ordinary line-bound plan, `prStrategyRecommendation` is present,
  normalizes successfully, and exactly matches the current workflow token,
  canonical plan comment ID, and normalized ADF fingerprint.
- Recommendation change areas and rationale are supported by independently
  checked repository evidence. Changed-line count never decides strategy.
- `single`, `independent`, or `stacked` matches the unit and dependency graph;
  both alternatives, all six decision factors, confidence, and risks are
  credible.
- Unit verification is decisive and cumulative: focused checks prove each
  boundary and end-to-end checks prove the integrated result in dependency
  order.
- Recommendation prose and state agree with the plan. The recommendation stays
  advisory, `deliveryPlan` stays the sole executable PR contract, and a
  stacked recommendation never claims current automation will create stacked
  branches or PR base relationships.
- The plan states a scope expectation, and its intended behavior, change areas
  and justified additions are supported by independently checked repository
  evidence. The prose section and the persisted
  `islo-plan-scope-expectation-v1` field agree, and the change areas cover the
  work the steps actually describe — including the generated trees the plan's
  own regeneration step refreshes — without being widened to cover the
  repository.
- An unjustified new abstraction, dependency, configuration surface or
  compatibility path is a `changes_requested` defect the planner can correct,
  never `human_needed`. Judge it against
  `standards/implementation-proportionality-contract.md`: the justification has
  to name something that needs it at this head, not a future that might.

Use `changes_requested` for defects the planner can correct. Use
`human_needed` only for a real human decision. Preferences, prose style, and
optional improvements do not block approval. A missing, malformed, stale, or
inconsistent required recommendation is a correctable defect, so reject it
through the existing planner revision loop. Direct runs and Epic documentation
child Tasks retain their explicitly documented compatibility boundaries. On a
revised plan, report only unresolved findings and newly introduced defects.
