import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { GitHub, threads } from '../skills/pr-monitor/scripts/github.mjs';
import { snapshot, graph } from '../skills/pr-monitor/scripts/snapshot.mjs';
import { install, main } from '../skills/pr-monitor/scripts/cli.mjs';

const REPO = 'owner/repo', SHA = 'a'.repeat(40), BASE = 'b'.repeat(40);
const user = {login:'reviewer',type:'User'};
const p = (number=1, head='feature', base='main', headRepo=REPO) => ({number,
  html_url:`https://github.com/${REPO}/pull/${number}`, draft:false,
  head:{ref:head,sha:SHA,repo:{full_name:headRepo}},base:{ref:base,sha:BASE,repo:{full_name:REPO}},
  requested_reviewers:[user], requested_teams:[]});
const thread = (id,resolved=false) => ({id,isResolved:resolved,isOutdated:true,path:'code.py',line:3,
  comments:{nodes:[{databaseId:1,url:'https://github.com/owner/repo/pull/1#discussion_r1'}]}});
const connection = (nodes,next=false,cursor=null) => ({data:{repository:{pullRequest:{reviewThreads:{
  nodes,pageInfo:{hasNextPage:next,endCursor:cursor}}}}}});
const rawComment = {id:1,html_url:'https://github.com/owner/repo/issues/1#issuecomment-1',
  user,updated_at:'2026-01-01T00:00:00Z',body:'private synthetic body'};
function fixture({move=false, denied=false}={}) {
  let reads=0;
  return {
    call(path,payload) { assert.equal(path,'graphql'); assert(!payload.query.includes('mutation'));
      return connection([thread('t1')]); },
    pages(path,key) {
      if (path.includes('/pulls?')) return [reads++ && move ? {...p(),head:{...p().head,sha:'c'.repeat(40)}} : p()];
      if (path.includes('/reviews?')) return [{id:9,html_url:'https://github.com/owner/repo/pull/1#pullrequestreview-9',
        user,author_association:'MEMBER',state:'APPROVED',commit_id:'old-head',body:''}];
      if (path.includes('/comments?')) return [rawComment];
      assert.equal(key,'workflow_runs');
      if (denied) throw new Error('forbidden secret-content');
      return [{id:4,name:'CI',path:'.github/workflows/ci.yml',event:'pull_request',head_sha:SHA,
        head_repository:{full_name:REPO},pull_requests:[{number:1,head:{sha:SHA},base:{sha:'old-base',ref:'main'}}],
        status:'completed',conclusion:'success',html_url:'https://github.com/owner/repo/actions/runs/4'}];
    },
  };
}

test('REST pagination flattens every page and uses argv, not shell interpolation', () => {
  const api = new GitHub((cmd,args,opts) => {
    assert.equal(cmd,'gh'); assert(args.includes('--paginate')); assert(args.includes('--slurp'));
    assert.equal(opts.stdio[2],'pipe'); return JSON.stringify([[1],[2]]);
  });
  assert.deepEqual(api.pages('repos/owner/repo/pulls'),[1,2]);
});
test('GraphQL pagination retains outdated but unresolved threads', () => {
  const api={call(path,payload) { return payload.variables.cursor ? connection([thread('second',true)]) :
    connection([thread('first')],true,'next'); }};
  assert.deepEqual(threads(api,REPO,1).map(t=>[t.id,t.resolved]),[['first',false],['second',true]]);
});
test('GraphQL errors and stalled pagination fail instead of reporting no threads', () => {
  assert.throws(()=>threads({call:()=>({errors:[{}]})},REPO,1),/incomplete/);
  assert.throws(()=>threads({call:()=>connection([],true,'same')},REPO,1),/advance/);
});
test('snapshot exposes stale approvals and wrong-base green runs without claiming readiness', () => {
  const result=snapshot(fixture(),REPO);
  assert.equal(result.complete,true); assert.equal(result.unresolved_threads.length,1);
  assert.equal(result.prs[0].reviews[0].current_head,false);
  assert.equal(result.prs[0].reviews[0].reviewed_base,'unknown');
  assert.equal(result.prs[0].actions.runs[0].current_integration,false);
  assert(!JSON.stringify(result).includes('private synthetic body'));
  assert.equal(result.prs[0].inline_comments[0].body_sha256.length,64);
});
test('edited comments have different fingerprints', () => {
  const before=snapshot(fixture(),REPO), api=fixture(), old=api.pages;
  api.pages=(path,key)=>path.includes('/comments?') ? [{...rawComment,body:'edited'}] : old(path,key);
  assert.notEqual(before.prs[0].issue_comments[0].body_sha256,
    snapshot(api,REPO).prs[0].issue_comments[0].body_sha256);
});
test('moving refs and unavailable Actions evidence remain incomplete', () => {
  const moved=snapshot(fixture({move:true}),REPO), denied=snapshot(fixture({denied:true}),REPO);
  assert.equal(moved.complete,false); assert.equal(moved.consistent_refs,false);
  assert.equal(denied.complete,false); assert.equal(denied.prs[0].actions.available,false);
  assert(!JSON.stringify(denied).includes('secret-content'));
});
test('missing requested PRs and inaccessible discussions fail loudly', () => {
  assert.throws(()=>snapshot(fixture(),REPO,[99]),/not open/);
  const api=fixture(); api.call=()=>{throw new Error('unavailable');};
  assert.throws(()=>snapshot(api,REPO),/unavailable/);
});
test('repository validation rejects option and endpoint injection', () => {
  for (const name of ['--help','../repo','owner/repo?x=y','owner/repo/extra']) {
    assert.throws(()=>snapshot(fixture(),name),/owner\/repo/);
  }
});
test('stack graph uses branch and repository identity, detects ambiguity and cycles', () => {
  const parsed=(number,head,base,repo=REPO)=>({number,head:{ref:head,repo},base:{ref:base,repo:REPO}});
  assert.deepEqual(graph([parsed(20,'first','main'),parsed(3,'child','first')]).map(x=>x.parent),[null,20]);
  assert.equal(graph([parsed(20,'first','main','fork/repo'),parsed(3,'child','first')])[1].parent,null);
  assert.throws(()=>graph([parsed(1,'a','b'),parsed(2,'b','a')]),/cycle/);
  assert.throws(()=>graph([parsed(1,'a','main'),parsed(2,'a','main'),parsed(3,'child','a')]),/Ambiguous/);
});
test('gh errors do not print credentials or response bodies', () => {
  const api=new GitHub(()=>{throw new Error('token=synthetic-secret');});
  assert.throws(()=>api.call('repos/owner/repo/pulls'), error=>!error.message.includes('synthetic-secret'));
});
test('installer copies a complete skill and refuses existing destinations/symlinks', () => {
  const temp=mkdtempSync(join(tmpdir(),'pr-monitor-install-'));
  const target=install(temp);
  assert(readFileSync(join(target,'SKILL.md'),'utf8').includes('name: pr-monitor'));
  assert(existsSync(join(target,'scripts/snapshot.mjs')));
  writeFileSync(join(target,'local-note'),'preserve');
  assert.throws(()=>install(temp)); assert.equal(readFileSync(join(target,'local-note'),'utf8'),'preserve');
  const second=mkdtempSync(join(tmpdir(),'pr-monitor-link-'));
  symlinkSync(target,join(second,'pr-monitor')); assert.throws(()=>install(second));
});
test('installer rejects installing recursively inside its source', () => {
  assert.throws(()=>install(resolve('skills/pr-monitor/scripts')),/inside/);
  const root=mkdtempSync(join(tmpdir(),'pr-monitor-source-link-'));
  symlinkSync(resolve('skills/pr-monitor'),join(root,'source'));
  assert.throws(()=>install(join(root,'source','scripts')),/inside/);
});
test('CLI rejects overwriting evidence, unsupported auth flags, and duplicate options before network access', () => {
  const root=mkdtempSync(join(tmpdir(),'pr-monitor-output-')), output=join(root,'evidence.json');
  writeFileSync(output,'prior evidence');
  assert.throws(()=>main(['snapshot',REPO,'--output',output]),/already exists/);
  assert.equal(readFileSync(output,'utf8'),'prior evidence');
  assert.throws(()=>main(['snapshot',REPO,'--token','synthetic']),/Unknown/);
  assert.throws(()=>main(['snapshot',REPO,'--pr','1','--pr','2']),/duplicate/);
});

test('npm-style symlink entrypoint actually executes the CLI', async () => {
  const {execFileSync} = await import('node:child_process');
  const root=mkdtempSync(join(tmpdir(),'pr-monitor-bin-')), bin=join(root,'pr-monitor');
  symlinkSync(resolve('skills/pr-monitor/scripts/cli.mjs'),bin);
  const output=execFileSync(process.execPath,[bin,'--help'],{encoding:'utf8'});
  assert(output.includes('PR Monitor —'));
});
