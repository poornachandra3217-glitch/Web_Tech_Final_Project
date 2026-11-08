// Explicitly authorized live assessment smoke test. Creates labelled synthetic records.
// Run only against the assessment URL; credentials, cookies and private evidence are never exported.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import newman from 'newman';
const base = 'https://campusfind-sai.onrender.com';
if (process.env.CONFIRM_LIVE_TEST !== 'yes') throw Error('Set CONFIRM_LIVE_TEST=yes to authorize retained synthetic records.');
const run = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const out = 'docs/live-testing';
await fs.mkdir(out, {recursive:true});
const evidence = {startedAt:new Date().toISOString(), url:base, run, checks:[], records:[], limitations:['Real-browser authenticated dashboard and mobile layout checks are separate from API checks.','Positive administrator access requires a private administrator session and is not tested by these synthetic student accounts.']};
function check(ok, name, details={}) {
  evidence.checks.push({name,result:ok?'PASS':'FAIL',...details});
  console.log(`${ok?'PASS':'FAIL'} ${name}`);
  if(!ok) throw Error(name);
}
function client() {
  let cookie='',csrf='';
  return {async call(path,method='GET',body,options={}) {
    const headers={}; if(cookie) headers.cookie=cookie;
    if(method!=='GET'&&!options.noCsrf) headers['x-csrf-token']=csrf;
    if(body&&!(body instanceof FormData)) headers['content-type']='application/json';
    const response=await fetch(base+'/api'+path,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
    const set=response.headers.getSetCookie(); if(set.length) cookie=set[0].split(';')[0];
    const data=await response.json(); if(data.csrfToken) csrf=data.csrfToken;
    return {status:response.status,data,headers:response.headers};
  }};
}
const accounts=[];
async function register(label) {
  const c=client(),email=`qa-${label}-${run}@example.com`,password=crypto.randomBytes(24).toString('base64url');
  await c.call('/auth/me');
  const r=await c.call('/auth/register','POST',{name:`QA ${label} (synthetic assessment)`,email,password});
  check(r.status===201&&r.data.user.role==='student',`${label}: registration creates student`,{httpStatus:r.status});
  accounts.push({c,email,password}); return accounts.at(-1);
}
try {
  let r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(90000)});
  check(r.status===200&&(await r.json()).status==='ok','Live database health');
  r=await fetch(base+'/',{signal:AbortSignal.timeout(90000)});
  check(r.status===200&&(await r.text()).includes('CampusFind'),'Live frontend HTML served');
  check(r.headers.has('content-security-policy')&&r.headers.get('x-content-type-options')==='nosniff','Production security headers');
  const anon=client(); await anon.call('/auth/me');
  r=await anon.call('/items','POST',{}); check(r.status===401,'Anonymous report denied',{httpStatus:r.status});
  r=await anon.call('/auth/register','POST',{name:'QA invalid',email:'invalid',password:'short'});check(r.status===400,'Invalid registration denied',{httpStatus:r.status});
  const reporter=await register('reporter'), claimant=await register('claimant'), stranger=await register('stranger');
  r=await claimant.c.call('/admin/stats');check(r.status===403,'Student denied administrator statistics',{httpStatus:r.status});
  const fields={name:`QA LIVE notebook ${run}`,description:'Synthetic assessment record; no real property. Fictional orange page tabs distinguish this notebook.',category:'Books',location:'Library',date:new Date().toISOString().slice(0,10),type:'found'};
  r=await reporter.c.call('/items','POST',fields,{noCsrf:true});check(r.status===403,'Missing CSRF token denied',{httpStatus:r.status});
  r=await reporter.c.call('/items','POST',{...fields,date:'2099-01-01'});check(r.status===400,'Future report date denied',{httpStatus:r.status});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
  const form=new FormData(); for(const [k,v] of Object.entries(fields)) form.set(k,v);
  form.set('image',new Blob([png],{type:'image/png'}),'qa-live.png');
  r=await reporter.c.call('/items','POST',form);check(r.status===201,'Multipart report and image created',{httpStatus:r.status});
  const item=r.data.id; evidence.records.push({itemId:item,name:fields.name});
  const image=await fetch(`${base}/api/items/${item}/image`,{signal:AbortSignal.timeout(30000)});
  check(image.status===200&&Buffer.from(await image.arrayBuffer()).equals(png),'Persisted image retrieved with exact bytes');
  r=await reporter.c.call('/items/'+item,'PATCH',{...fields,name:fields.name+' verified'});check(r.status===200,'Reporter updates own report',{httpStatus:r.status});
  r=await stranger.c.call('/items/'+item,'PATCH',{status:'closed'});check(r.status===403,'Another student cannot edit report',{httpStatus:r.status});
  r=await anon.call('/items?q='+encodeURIComponent(run)+'&category=Books&location=Library&type=found');check(r.status===200&&r.data.items.some(i=>i._id===item),'Keyword/category/building/type filters retrieve report');
  r=await reporter.c.call('/items?mine=true');check(r.status===200&&r.data.items.some(i=>i._id===item),'Student dashboard personal-listings data');
  r=await anon.call('/items/'+item);check(r.status===200&&!r.data.owner.email&&!r.data.owner.passwordHash,'Public detail excludes reporter credentials');
  r=await reporter.c.call('/items/'+item+'/claims','POST',{evidence:'Synthetic self claim used only for testing.'});check(r.status===400,'Reporter cannot claim own item',{httpStatus:r.status});
  r=await claimant.c.call('/items/'+item+'/claims','POST',{evidence:'mine'});check(r.status===400,'Short claim evidence denied',{httpStatus:r.status});
  r=await claimant.c.call('/items/'+item+'/claims','POST',{evidence:'Synthetic orange page tabs identify the assessment notebook.'});check(r.status===201,'Claim submitted',{httpStatus:r.status});const claim=r.data.id;
  r=await claimant.c.call('/items/'+item+'/claims','POST',{evidence:'Synthetic duplicate claim must be rejected.'});check(r.status===409,'Duplicate claim denied',{httpStatus:r.status});
  r=await stranger.c.call('/claims');check(r.status===200&&!r.data.claims.some(c=>c._id===claim),'Uninvolved student cannot see private claim');
  r=await claimant.c.call('/claims/'+claim,'PATCH',{status:'approved'});check(r.status===403,'Claimant cannot approve own claim',{httpStatus:r.status});
  r=await reporter.c.call('/claims');check(r.status===200&&r.data.claims.some(c=>c._id===claim),'Reporter dashboard incoming request');
  r=await stranger.c.call('/items/'+item+'/claims','POST',{evidence:'Synthetic competing ownership evidence, intentionally incorrect.'});check(r.status===201,'Second synthetic claim submitted',{httpStatus:r.status});const rejected=r.data.id;
  r=await reporter.c.call('/claims/'+rejected,'PATCH',{status:'rejected',reviewNote:'QA synthetic rejection verification.'});check(r.status===200,'Reporter rejects claim',{httpStatus:r.status});
  r=await stranger.c.call('/claims');check(r.data.claims.some(c=>c._id===rejected&&c.status==='rejected'),'Claimant dashboard displays rejection');
  r=await reporter.c.call('/claims/'+claim,'PATCH',{status:'approved',reviewNote:'QA synthetic recovery; no real property exchanged.'});check(r.status===200,'Reporter approves transaction',{httpStatus:r.status});
  r=await anon.call('/items/'+item);check(r.data.status==='recovered','Recovered item status persisted');
  r=await claimant.c.call('/claims');check(r.data.claims.some(c=>c._id===claim&&c.status==='approved'),'Claimant dashboard displays approval');
  r=await reporter.c.call('/items/'+item,'PATCH',{status:'open'});check(r.status===409,'Recovered item cannot reopen',{httpStatus:r.status});
  evidence.records[0]={...evidence.records[0],claimId:claim,rejectedClaimId:rejected,status:'recovered'};
  r=await reporter.c.call('/auth/logout','POST');check(r.status===200,'Reporter logout');
  r=await reporter.c.call('/items?mine=true');check(r.status===401,'Logout removes protected access',{httpStatus:r.status});
  await reporter.c.call('/auth/me');
  r=await reporter.c.call('/auth/login','POST',{email:reporter.email,password:reporter.password});check(r.status===200,'Existing registered user can log in again',{httpStatus:r.status});
  for(const a of accounts) await a.c.call('/auth/logout','POST');
  // The supplied Postman collection runs unchanged except for synthetic labels and ephemeral credentials.
  const password=crypto.randomBytes(24).toString('base64url');
  const raw=(await fs.readFile('postman/CampusFind.postman_collection.json','utf8')).replaceAll('Postman-Test-Password-123!',password).replaceAll('Postman blue backpack','QA Postman blue backpack').replaceAll('Postman verified blue backpack','QA Postman verified blue backpack').replaceAll('Postman Reporter','QA Postman Reporter').replaceAll('Postman Claimant','QA Postman Claimant');
  const summary=await new Promise((resolve,reject)=>newman.run({collection:JSON.parse(raw),environment:{values:[{key:'baseUrl',value:base,enabled:true}]},reporters:['cli'],timeoutRequest:90000,color:'off'},(err,s)=>err?reject(err):resolve(s)));
  const safe={completedAt:new Date().toISOString(),url:base,stats:summary.run.stats,timings:summary.run.timings,failures:summary.run.failures.map(f=>({source:f.source?.name,error:f.error?.name})),executions:summary.run.executions.map(e=>({name:e.item.name,method:e.request.method,status:e.response?.code,responseTimeMs:e.response?.responseTime,assertions:(e.assertions||[]).map(a=>({name:a.assertion,passed:!a.error}))}))};
  await fs.writeFile(out+'/postman-live-results.json',JSON.stringify(safe,null,2)+'\n');
  check(summary.run.failures.length===0,'Live Postman collection passes',{requests:summary.run.stats.requests.total,assertions:summary.run.stats.assertions.total});
} catch(error) {
  evidence.error=error.name==='TimeoutError'?'Request timeout':error.message;
  console.error('Verification stopped: '+evidence.error);process.exitCode=1;
} finally {
  evidence.completedAt=new Date().toISOString();evidence.passed=evidence.checks.filter(c=>c.result==='PASS').length;evidence.failed=evidence.checks.filter(c=>c.result==='FAIL').length;evidence.complete=!evidence.error;
  await fs.writeFile(out+'/live-results.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(`LIVE RESULT: ${evidence.passed} passed; ${evidence.failed} failed; complete=${evidence.complete}`);
}
