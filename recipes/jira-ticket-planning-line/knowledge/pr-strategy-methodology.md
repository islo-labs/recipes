# Pull request strategy methodology

Use this framework to recommend a review and delivery shape from repository
evidence. It is general planning guidance, not a claim about the correct
outcome for any ticket.

## Establish candidate units

Identify coherent change units from verified files, modules, interfaces,
owners, deployment boundaries, and tests. For each unit, record its repository,
change areas, prerequisites, verification intent, and risk. A useful boundary
has one purpose and can be reviewed without hidden context.

Changed-line count is not a decision rule. Size may affect review effort, but
small changes can be tightly coupled and large mechanical changes can remain
atomic.

## Compare every strategy

- **Single** — one root unit. Prefer when changes form one atomic behavior,
  splitting would expose an invalid intermediate state, or duplicated
  coordination and CI outweigh review gains.
- **Independent** — two or more root units in distinct repositories with no
  dependency edges. Prefer when each unit is independently useful,
  verifiable, releasable, and reversible.
- **Stacked** — two or more units with exactly one root and at least one
  dependency edge. Consider when ordered review boundaries materially improve
  understanding but later units cannot stand alone.

Always explain why the two non-selected strategies are worse for the observed
change. Do not use ticket wording as proof; cite repository structures,
interfaces, tests, ownership, and release behavior.

## Decision factors

Assess all six factors:

1. **Coupling** — shared interfaces, invariants, schemas, migrations, or
   generated artifacts that bind units together.
2. **Atomicity** — whether intermediate merges or releases remain correct.
3. **Review isolation** — whether boundaries reduce reviewer context without
   hiding end-to-end behavior.
4. **CI duplication** — repeated builds, fixtures, environments, or integration
   suites introduced by splitting.
5. **Rollback isolation** — whether a unit can be reverted or disabled without
   leaving dependents broken.
6. **Critical-path impact** — merge ordering, ownership handoffs, deployment
   sequencing, and time-to-feedback.

## Verification and confidence

Each unit needs focused verification, and the complete graph needs cumulative
verification of the integrated outcome. Dependency direction must match
provider/consumer and rollout order. Confidence reflects evidence quality:
lower it for unread repositories, uncertain ownership, unverified interfaces,
or unavailable integration checks.

## Advisory boundary

The recommendation explains a preferred shape; it is not executable workflow
state. `deliveryPlan` remains the sole machine-executable PR contract. Current
implementation automation does not create stacked PR branches or stacked PR
base relationships, so a stacked recommendation must disclose that limitation
and must not be presented as currently automated execution.
