# Operational details

## Brief replies

Match the user's voice: short, conversational, specific. Avoid generic praise,
invented attribution, and asserting success before verification.

- Fix: “Fixed. Unrelated processing errors now leave readiness alone. Added the
  malformed-message regression; tests and current CI pass.” Add evidence links.
- Not applicable: “Checked with those environment variables unset. The tests pass
  with the pinned SDK; its defaults already cover this case. No code change needed.”
- Duplicate: “Same path as the other comment, covered by that fix too.” Link the
  fix and other reply; similarity alone does not justify resolution.
- Pending: “The change is pushed. CI is still running, so I’m leaving this open
  until that finishes.” Drafts and intentions are not applied changes.

## Evidence and races

Record head SHA, base SHA/ref, thread IDs, comment IDs/fingerprints, review IDs,
and applicable CI run IDs. Paginate every connection. Inspect top-level comments
and submitted-review bodies too; a resolved thread can have later follow-up.

Before replies, resolutions, brief writes, review-state changes, or merges,
refresh the relevant refs and discussion evidence. Reconcile changes first.
For a shared coordinator comment, re-read its body AFTER the final API-backed
checks and immediately before writing. Preserve task links, checklists, and
unknown human text. This narrows a race; do not claim atomic conditional writes
unless the actual API enforces them.

Avoid repeated same-head brief refreshes. Preserve substantial history in the
existing journal or GitHub edit history with links. Never silently truncate
human criteria to fit an API limit. A bot tag/request is not proof a new review
started: distinguish requested, running, completed, and blocked.

Read failure logs before changing CI. Retry a transient failure once without
new evidence; repeated identical failures need diagnosis or a blocker report.
Handle 401/403 as access problems; honor rate-limit reset/retry information.

## Merge and restack

Merge only with current user authorization and repository gates: applicable
independent/human approval, no outstanding required conversations, current
integration checks, non-draft state, correct target, and satisfied dependencies
or an approved queue enforcing them. Credentials alone are not authorization.
Never self-approve, bypass protection, or use admin merge to clear a blocker.
Use the actual required approval count and CODEOWNERS rules. If one eligible
human approval satisfies them, do not wait for every requested reviewer. Keep
explicit parent-merge and deployment holds until the user changes them; other
merge authorization does not lift those holds.

Verify reviewed head AND base. GitHub review commit_id records the head, not its
reviewed base. Use repository evidence or fresh review; do not infer base coverage
from an approval badge. A permitted range-diff assessment can support an unchanged
restack, but cannot replace required platform approvals.

Inspect the configured queue's behavior before invoking it: some native stack
operations also merge ancestors. If a parent must remain open, do not submit a
stack operation that would merge it. Safely detach/reconcile the eligible child
when that is authorized, or keep it pending.

Use the configured queue and merge method. Preserve the old parent tip and each
child's unique range before merging. After a squash, rebase descendants' unique
commits onto the new integration tip; a simple base retarget can reintroduce the
squashed parent. Retarget direct children, retain deeper relationships, inspect
range-diffs, test, push with leases, and renew evidence. Keep parent refs until
children no longer need them. Verify the remote merge commit before claiming it.
Then run [post-merge hygiene and cleanup](post-merge.md), including PR evidence,
remote refs, and local worktrees; preserve the ledger until reconciliation is proven.

## Checkpoint and watch

Record repository/scope, user authorization and source, PR graph, head/base SHAs,
finding classification, fix SHA, checks, reply URL, resolution, review request,
size decision, merge target/SHA, and next action. Pending drafts are not replies.

Watch with interruptible waits and a stated deadline. Stop when scoped work is
resolved, the requested watch expires, the user stops it, or an external blocker
prevents progress. Continue independent authorized work while approval is pending.
Do not create a scheduler or claim monitoring survives the session without a
real authorized runner. A final zero-outstanding statement is timestamped evidence,
not a promise about future reviews. Parent merges, integration, release, and
production deployment remain separate progress states.
