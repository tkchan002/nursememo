import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAdminCommand,InputError} from '../supabase/functions/_shared/admin-users-policy.mjs';
import {issueAppLoginSession} from '../supabase/functions/_shared/app-login-flow.mjs';

const id='12345678-1234-4234-a234-1234567890ab';
const ward='aaaabbbb-1234-4234-a234-1234567890ab';
function fakeAdmin({verifiedId=id,linkId=id,otpId=id,accept=true}={}) {
  const calls=[];
  const admin={
    rpc:async(name,args)=>{calls.push(['verify',name,args]);return {data:accept?verifiedId:null,error:null};},
    auth:{
      admin:{
        getUserById:async userId=>{calls.push(['auth-user',userId]);return {data:{user:{id:userId,email:'existing-auth@example.test'}},error:null};},
        generateLink:async params=>{calls.push(['generate',params]);return {data:{user:{id:linkId},properties:{hashed_token:'server-only-otp'}},error:null};},
      },
      verifyOtp:async params=>{calls.push(['exchange',params]);return {data:{user:{id:otpId},session:{access_token:'user-access',refresh_token:'user-refresh'}},error:null};},
    },
  };
  return {admin,calls};
}
test('successful app login establishes session for existing UUID; no Auth password is read or changed',async()=>{
  const {admin,calls}=fakeAdmin();
  assert.deepEqual(await issueAppLoginSession(admin,'Patrol','patrol'),{access_token:'user-access',refresh_token:'user-refresh'});
  assert.deepEqual(calls.map(x=>x[0]),['verify','auth-user','generate','exchange']);
  assert.deepEqual(calls[0][2],{p_login_id:'Patrol',p_password:'patrol'});
  assert.deepEqual(calls[2][1],{type:'magiclink',email:'existing-auth@example.test'});
  assert.deepEqual(calls[3][1],{type:'magiclink',token_hash:'server-only-otp'});
  assert.doesNotMatch(JSON.stringify(calls),/updateUserById|signInWithPassword/);
});
test('failed app credential cannot generate a magic link or session',async()=>{
  const {admin,calls}=fakeAdmin({accept:false});
  assert.equal(await issueAppLoginSession(admin,'Patrol','incorrect'),null);
  assert.deepEqual(calls.map(x=>x[0]),['verify']);
});
test('OTP exchange cannot impersonate another Auth user',async()=>{
  const {admin,calls}=fakeAdmin({otpId:'other-user'});
  await assert.rejects(issueAppLoginSession(admin,'Patrol','patrol'),/Unable to establish account session/);
  assert.equal(calls.at(-1)[0],'exchange');
});
test('link for the wrong user is not consumed',async()=>{
  const {admin,calls}=fakeAdmin({linkId:'other-user'});
  await assert.rejects(issueAppLoginSession(admin,'Patrol','patrol'),/Unable to establish account session/);
  assert.equal(calls.at(-1)[0],'generate');
});
test('Maintenance account edit allows a display-only update without resending an old role',()=>{
  const changes=parseAdminCommand({action:'update_account',auth_user_id:id,display_name:'New Name'});
  assert.deepEqual(changes,{action:'update_account',auth_user_id:id,changes:{display_name:'New Name'}});
  assert.deepEqual(parseAdminCommand({action:'update_account',auth_user_id:id,login_id:'PatrolNew'}).changes,
    {login_id:'PatrolNew'});
  assert.deepEqual(parseAdminCommand({action:'update_account',auth_user_id:id,role:'ward',ward_id:ward}).changes,
    {role:'ward',ward_id:ward});
  assert.throws(()=>parseAdminCommand({action:'update_account',auth_user_id:id,role:'unknown'}),InputError);
});
test('new account and password reset are application-credentials and Auth password remains unaffected',()=>{
  const edge=readFileSync(new URL('../supabase/functions/admin-users/index.ts',import.meta.url),'utf8');
  assert.match(edge,/app_login_set_password/);
  assert.match(edge,/app_update_account/);
  assert.doesNotMatch(edge,/auth\.admin\.updateUserById/);
  const sql=readFileSync(new URL('../supabase/EXISTING_PROJECT_LOGIN_UPGRADE.sql',import.meta.url),'utf8');
  assert.match(sql,/on conflict\(auth_user_id\) do nothing/);
  assert.match(sql,/gen_salt\('bf',10\)/);
  assert.match(sql,/locked_until/);
  assert.doesNotMatch(sql,/drop (?:schema|table)|truncate|delete from auth\.users|update auth\.users/i);
});
test('Ward NIL fixes remain integrated in the same repository',()=>{
  const report=readFileSync(new URL('../domain/report-model.js',import.meta.url),'utf8');
  const printing=readFileSync(new URL('../ward-print.js',import.meta.url),'utf8');
  assert.match(report,/nilConsultation:\s*false/);
  assert.match(report,/nilIntubation:\s*false/);
  assert.match(printing,/nilConsultation|nilIntubation/);
});
