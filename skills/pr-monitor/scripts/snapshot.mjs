import { createHash } from 'node:crypto';
import { array, boolean, integer, object, repository, string, threads } from './github.mjs';

const digest = text => createHash('sha256').update(string(text ?? '')).digest('hex');
function actor(raw) {
  if (raw == null) return null;
  const user = object(raw);
  return {login: string(user.login), type: string(user.type)};
}
function ref(raw) {
  const value = object(raw);
  return {ref: string(value.ref), sha: string(value.sha),
    repo: value.repo == null ? null : string(object(value.repo).full_name)};
}
function pull(raw) {
  const p = object(raw);
  return {number: integer(p.number), url: string(p.html_url), draft: boolean(p.draft),
    head: ref(p.head), base: ref(p.base),
    requested_reviewers: array(p.requested_reviewers).map(actor),
    requested_teams: array(p.requested_teams).map(t => string(object(t).slug))};
}
function comment(raw) {
  const c = object(raw);
  return {id: integer(c.id), url: string(c.html_url), author: actor(c.user),
    updated_at: string(c.updated_at), body_sha256: digest(c.body),
    reply_to: c.in_reply_to_id == null ? null : integer(c.in_reply_to_id)};
}
function review(raw, head) {
  const r = object(raw);
  return {id: integer(r.id), url: string(r.html_url), author: actor(r.user),
    association: string(r.author_association), state: string(r.state),
    commit: r.commit_id == null ? null : string(r.commit_id),
    current_head: r.commit_id === head, reviewed_base: 'unknown', body_sha256: digest(r.body)};
}
export function graph(pulls) {
  const edges = pulls.map(p => {
    const parents = pulls.filter(other => other.number !== p.number && other.head.repo != null &&
      other.head.repo === p.base.repo && other.head.ref === p.base.ref);
    if (parents.length > 1) throw new Error(`Ambiguous parent for PR #${p.number}`);
    return {number: p.number, parent: parents[0]?.number ?? null, base: p.base.ref};
  });
  const byNumber = new Map(edges.map(e => [e.number, e]));
  for (const edge of edges) {
    const seen = new Set();
    for (let next = edge; next; next = byNumber.get(next.parent)) {
      if (seen.has(next.number)) throw new Error('PR dependency cycle');
      seen.add(next.number);
    }
  }
  return edges;
}
function runs(api, prefix, p) {
  try {
    const items = api.pages(`${prefix}/actions/runs?head_sha=${p.head.sha}&per_page=100`, 'workflow_runs');
    return {available: true, runs: items.map(raw => {
      const r = object(raw);
      const headMatches = r.head_sha === p.head.sha && object(r.head_repository).full_name === p.head.repo;
      const integrationMatches = headMatches && r.event === 'pull_request' && array(r.pull_requests).some(rawPR => {
        const pr = object(rawPR), head = object(pr.head), base = object(pr.base);
        return pr.number === p.number && head.sha === p.head.sha && base.sha === p.base.sha && base.ref === p.base.ref;
      });
      return {id: integer(r.id), name: string(r.name), path: string(r.path), event: string(r.event),
        status: string(r.status), conclusion: r.conclusion == null ? null : string(r.conclusion),
        url: string(r.html_url), current_head: headMatches, current_integration: integrationMatches};
    })};
  } catch {
    return {available: false, runs: [], limitation: 'Actions evidence unavailable; verify access and required providers separately.'};
  }
}

/** @feature PRMonitor @breadcrumb 2 @obsidian_tag #PRMonitor @obsidian_color cyan
 * Inventory evidence without judging findings, granting approval, or mutating GitHub.
 */
export function snapshot(api, repo, numbers = []) {
  repository(repo);
  const prefix = `repos/${repo}`, started = new Date().toISOString();
  const all = api.pages(`${prefix}/pulls?state=open&per_page=100`).map(pull);
  for (const number of numbers) {
    if (!all.some(p => p.number === number)) throw new Error(`PR #${number} is not open in ${repo}`);
  }
  const selected = all.filter(p => !numbers.length || numbers.includes(p.number));
  const details = selected.map(p => ({...p,
    threads: threads(api, repo, p.number),
    reviews: api.pages(`${prefix}/pulls/${p.number}/reviews?per_page=100`).map(r => review(r, p.head.sha)),
    inline_comments: api.pages(`${prefix}/pulls/${p.number}/comments?per_page=100`).map(comment),
    issue_comments: api.pages(`${prefix}/issues/${p.number}/comments?per_page=100`).map(comment),
    actions: runs(api, prefix, p),
  }));
  const fresh = api.pages(`${prefix}/pulls?state=open&per_page=100`).map(pull);
  const refs = list => list.map(p => [p.number, p.head, p.base]).sort((a,b) => a[0] - b[0]);
  const stable = JSON.stringify(refs(all)) === JSON.stringify(refs(fresh));
  return {schema_version: 1, repository: repo, started_at: started, checked_at: new Date().toISOString(),
    complete: stable && details.every(p => p.actions.available), consistent_refs: stable,
    limitations: ['Point-in-time reads are not an atomic snapshot; refresh relevant evidence before mutations.',
      'Actions runs do not establish all required checks or merge eligibility.',
      'Review commit IDs do not establish the reviewed base; verify discussion and approval applicability.'],
    open_pr_count: all.length, selected_pr_count: details.length,
    scope: numbers.length ? {kind: 'explicit', numbers} : {kind: 'all-open'},
    graph: graph(all), prs: details,
    unresolved_threads: details.flatMap(p => p.threads.filter(t => !t.resolved).map(t => ({pr: p.number, ...t}))),
  };
}
