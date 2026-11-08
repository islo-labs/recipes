# Spec review definition of ready

Shared, versioned rubric for `platform-ticket-spec-review`
(`platform-spec-review-rubric-v1`). Issue-type addenda live in the Bug,
Feature, and Task knowledge items. Project addenda are selected from
adoption knowledge tags.

## Purpose

Decide whether a Jira ticket is specific enough for a planner to produce an
executable plan. Review the canonical description plus later human comments.
Do not implement. Do not rewrite the description.

## Pass bar

Approve when a competent implementer could start without inventing product
intent. Missing stylistic polish, optional context, or nice-to-have diagrams
are `style-only` and must not block.

Reject only for blocking reason codes. Feasibility or "contradicts code"
rejections require a repository file path or URL as evidence. If code cannot
be inspected within the adoption repository allow-list, do not claim
infeasibility.

## Required questions

1. **Goal.** What user or operational outcome changes if this ticket ships?
2. **Scope.** What is in and out of this ticket, in product terms?
3. **Acceptance.** How will a reviewer know it is done?
4. **Success signal.** What check, metric, or observable proves it worked?
5. **Constraints.** Known deadlines, compatibility, or non-goals that would
   invalidate an otherwise reasonable plan.

## Evidence

- Quote the ticket gap, then name the reason code.
- For code-backed claims, cite `owner/repo:path` or a permalink.
- Linked Jira/Confluence may supply context; they do not replace a missing
  canonical description.
- Human replies may resolve a gap for the next round without being copied
  into the description. Report `stale-description` when approval would rest
  only on comments.

## Iteration

On later rounds, report only unresolved or new gaps. Cap at three rounds,
then escalate. Never loop on the same hash and comment cursor.
