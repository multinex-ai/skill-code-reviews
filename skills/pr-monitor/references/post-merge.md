# Post-merge hygiene and cleanup

Run after a merge in the authorized scope, before claiming that slice is closed.
A read-only/status invocation produces the proposed actions only. Carry forward
current authorization, explicit parent holds, deployment holds, and repository
rules; this procedure grants no merge, deletion, or publication permission.

## Verify landing and reconcile PRs

1. Re-read the remote PR state, recorded head/base, merge method, merge commit,
   and actual destination ref. Fetch the relevant refs and verify that the merge
   commit is reachable from that destination. A merged badge or successful local
   command alone is insufficient. Record the PR URL, old head/base, merge SHA,
   destination SHA, and observation time.
2. Check the repository's current native branch-deletion and stack auto-retarget
   behavior. Observe what already happened before issuing duplicate mutations.
   Preserve the old parent tip and every open descendant's unique range. When
   changes landed through squash/rebase or a child merged into its parent, prove
   this slice's content against its recorded base and actual landing range:
   inspect scoped diffs/range-diffs or patch equivalence and conflict resolutions.
   Do not compare cumulative stack changes with one squash commit, infer landing
   from a matching subject, or use an ancestry failure as proof of lost content.
3. Reconcile descendants in dependency order. Verify native restacking first;
   otherwise replay only each child's unique range onto the correct current base
   within authorization. Inspect the effective diff, retarget direct children,
   retain deeper parent relationships, and renew current-head/current-base CI.
   Changed behavior or conflicts require fresh focused review; unchanged scope
   may retain review only when repository policy and platform gates permit it.
4. Refresh affected reviewer briefs, dependency graph, and the existing marked
   consolidated digest. Move coordination to the next lowest open PR when its
   root merges. Preserve original threads, human notes/checklists, task links,
   and prior evidence as history. Read back shared content immediately before
   writes. Request review only for changed scope or a required gate; resolve
   original threads only after verifying the correction and posting its evidence.
5. Remove an owned merged remote branch only when all open descendants have
   been reconciled and no pending work needs its ref. Re-read its exact remote
   SHA immediately before an authorized deletion; use an expected-SHA lease
   where supported. If native deletion already removed it, record that fact.
   Keep held parents and any uncertain/shared ref. Never delete an active branch
   just because another PR included equivalent content.

## Inventory and qualify local cleanup

Before removing anything, save a private repository-scoped inventory:

- `git worktree list --porcelain -z`: canonical path, HEAD, branch or detached
  state, lock/prune markers, plus owning task and active/idle status from the
  session ledger. Check running agents, shells, and demo/server sessions where
  available; cleanliness does not establish that a worktree is idle.
- For each in-scope path, record `git status --porcelain=v1 -z --untracked-files=all`
  and `git ls-files --others --ignored --exclude-standard -z`. Check submodules
  separately when present. Record filenames/status only, not file contents or
  credentials. Ignored caches, environment files, and unknown artifacts are not
  automatically disposable.
- Map each candidate's actual HEAD and local branch tip to its PR and verified
  landing evidence. A worktree can contain commits beyond the merged PR head;
  those commits must be accounted for separately. Preserve replay refs until all
  descendants and recoveries no longer need them.

Remove a worktree only when it is a task-owned temporary checkout, idle, unlocked,
clean, and its entire current content/history has been reconciled to verified
landing evidence. Untracked or ignored files require an identified owner and
authorized disposition; otherwise retain the worktree. Existing cleanup
authorization can cover positively identified disposable task caches; carry it
forward without asking again. Unknown files stay retained. Always retain
active fix, demo, user, primary, or uncertain worktrees unless separate explicit
instructions authorize that exact path and its contents.

For squash/rebase merges, retain the original range and landing proof outside the
candidate before removal. If equivalence is incomplete or conflict outcomes are
unclear, retain it with the missing proof named. A clean worktree or a branch name
containing a merged PR number is never sufficient evidence.

## Remove, verify, and report

1. From a retained checkout, re-read the candidate's HEAD, branch, status,
   unknown/ignored files, and active-use state immediately before removal. Abort
   that candidate if anything changed. Use `git worktree remove <exact-path>`;
   never use `--force`, recursive deletion, reset, clean, or stash to manufacture
   eligibility. A refusal is a retained item to investigate.
2. Delete an owned local branch only after no worktree uses it and no descendant
   or recovery requires it. Use `git branch -d <branch>` after the landing check.
   If Git refuses a squash/rebase branch despite recorded content equivalence,
   retain the ref and record the reason; do not silently switch to `-D`.
3. Preview stale administration with `git worktree prune --dry-run --verbose`.
   Prune only after every proposed entry is confirmed obsolete and its path is
   permanently gone. A disconnected mount, relocated checkout, locked entry, or
   another session's path is not stale proof; retain or repair it. Re-read the
   preview before normal prune; avoid broad expiry overrides or forced cleanup.
4. Re-list worktrees and refs and verify each intended removal and preservation.
   Record removed paths/branches, retained paths/branches with reasons, landing
   evidence, remaining PRs and fresh CI/review needs, unresolved conversations,
   and the next action. Keep merged-to-parent, integrated, released, and deployed
   states separate. Cleanup failure does not erase a verified merge, and a merge
   does not prove deployment or successful cleanup.
