import { execFileSync } from 'node:child_process';

/** @feature PRMonitor @breadcrumb 1 @obsidian_tag #PRMonitor @obsidian_color cyan
 * Read GitHub with the caller's existing gh authentication; never echo stderr.
 */
export class GitHub {
  constructor(run = execFileSync) { this.run = run; }
  call(path, payload, pages = false) {
    const args = ['api', path, '--method', payload ? 'POST' : 'GET'];
    if (pages) args.push('--paginate', '--slurp');
    if (payload) args.push('--input', '-');
    try {
      return JSON.parse(this.run('gh', args, {
        encoding: 'utf8', timeout: 90000, maxBuffer: 32 * 1024 * 1024,
        input: payload ? JSON.stringify(payload) : undefined,
        stdio: ['pipe', 'pipe', 'pipe'],
      }));
    } catch {
      throw new Error(`GitHub read failed (${path.split('?')[0]}). Check scoped authentication, access, and rate limits.`);
    }
  }
  pages(path, key) {
    return array(this.call(path, undefined, true)).flatMap(page =>
      array(key ? object(page)[key] : page));
  }
}
export function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an API object');
  return value;
}
export function array(value) {
  if (!Array.isArray(value)) throw new Error('Expected an API array');
  return value;
}
export function string(value) {
  if (typeof value !== 'string') throw new Error('Expected API text');
  return value;
}
export function integer(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Expected an API integer');
  return value;
}
export function boolean(value) {
  if (typeof value !== 'boolean') throw new Error('Expected an API boolean');
  return value;
}
export function repository(value) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) || value.split('/').some(v => v === '.' || v === '..')) {
    throw new Error('Repository must be owner/repo');
  }
  return value;
}

const QUERY = `query($owner:String!,$repo:String!,$number:Int!,$cursor:String){
  repository(owner:$owner,name:$repo){pullRequest(number:$number){
    reviewThreads(first:100,after:$cursor){pageInfo{hasNextPage endCursor}
      nodes{id isResolved isOutdated path line comments(first:1){nodes{databaseId url}}}
    }
  }}
}`;
export function threads(api, repo, number) {
  const [owner, name] = repo.split('/');
  let cursor = null;
  const result = [], seen = new Set();
  for (;;) {
    const response = object(api.call('graphql', {query: QUERY, variables: {owner, repo: name, number, cursor}}));
    if (response.errors) throw new Error('GitHub returned incomplete review-thread data');
    const connection = object(object(object(object(response.data).repository).pullRequest).reviewThreads);
    for (const value of ofArray(connection.nodes)) result.push(value);
    const page = object(connection.pageInfo);
    if (!boolean(page.hasNextPage)) return result;
    cursor = string(page.endCursor);
    if (!cursor || seen.has(cursor)) throw new Error('Review-thread pagination did not advance');
    seen.add(cursor);
  }
}
function* ofArray(nodes) {
  for (const raw of array(nodes)) {
    const t = object(raw), first = array(object(t.comments).nodes)[0];
    yield {
      id: string(t.id), resolved: boolean(t.isResolved), outdated: boolean(t.isOutdated),
      path: t.path == null ? null : string(t.path), line: t.line == null ? null : integer(t.line),
      comment_id: first ? integer(object(first).databaseId) : null,
      url: first ? string(object(first).url) : null,
    };
  }
}
