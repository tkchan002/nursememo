import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderNightStaffPrintHtml, renderNightRunnerPrintHtml } from '../night-roster-print.js';
import { renderManagerMemoPrintHtml } from '../manager-memo-print.js';
import { loginIdToEmail } from '../supabase/functions/_shared/login-identity.mjs';

const read = filename => readFile(new URL(`../${filename}`, import.meta.url), 'utf8');

test('roster print documents share a safely escaped branded header without changing other printouts', () => {
  const logoUrl = 'https://sample.invalid/assets/heart-logo.png?x=1&y=2';
  const opts = { reportingDate: '2026-10-16', logoUrl, fontSize: 12,
    printedAt: new Date('2026-10-15T22:00:00Z') };
  const staff = renderNightStaffPrintHtml({...opts, wardRosters: [
    {ward:{name:'C5'},nurses:[{role:'RN',name:'Test Nurse',appointmentDate:'01/01/2020'}]},
  ]});
  const runner = renderNightRunnerPrintHtml({...opts, runners: [
    {ward:{name:'C5'},role:'RN',name:'Test Nurse',appointmentDate:'01/01/2020'},
  ]});
  for (const html of [staff, runner]) {
    assert.match(html, /alt="Nurse Memo heart logo"/);
    assert.match(html, /heart-logo\.png\?x=1&amp;y=2/);
    assert.match(html, /roster-print-document/);
    assert.match(html, /--roster-font-size:12pt/);
    assert.match(html, /@page\{size:A4 portrait/);
    assert.match(html, /Test Nurse/);
  }
  assert.match(staff, /Night Staff List/);
  assert.match(runner, /Night Runner List/);
  const nonRoster = renderManagerMemoPrintHtml({title:'Night Memo',header:{},mainTableRows:[],infectionRows:[]});
  assert.doesNotMatch(nonRoster, /<img class="manager-print-logo"/);
  assert.doesNotMatch(nonRoster, /--roster-font-size:/);
});

test('roster document font sizes are clamped; untrusted values cannot inject CSS or markup', () => {
  const large = renderNightRunnerPrintHtml({fontSize: 500, logoUrl:'\" onerror=\"x'});
  const small = renderNightRunnerPrintHtml({fontSize: -100});
  assert.match(large, /--roster-font-size:14pt/);
  assert.match(small, /--roster-font-size:8pt/);
  assert.doesNotMatch(large, /src="" onerror="x"/);
});

test('Manager exposes a modal preview instead of navigating immediately from roster buttons', async () => {
  const html = await read('manager.html');
  const js = await read('pages/manager-night-operations.js');
  for (const id of ['rosterPreviewModal','rosterPreviewFrame','rosterPreviewFontSize',
    'rosterPreviewPrintBtn','rosterPreviewCloseBtn','rosterPreviewResetBtn']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(js, /showRosterPreview\('staff'\)/);
  assert.match(js, /showRosterPreview\('runner'\)/);
  assert.match(js, /rosterPreviewFrame'\)\.removeAttribute\('srcdoc'\)/);
  assert.match(js, /openPrintView\(\{ html, title, kind: 'night-roster' \}\)/);
  assert.match(js, /heart-logo\.png/);
  assert.match(html, /min="8" max="14"/);
});

test('screen typography is enhanced without altering print-sheet sizes', async () => {
  const theme = await read('css/theme.css');
  assert.match(theme, /body\.legacy-page\.ward-page, body\.legacy-page\.manager-page,/);
  assert.match(theme, /font-size:14px; line-height:1\.43/);
  assert.match(theme, /font-size:13px; line-height:18px; min-height:28px; height:28px/);
  assert.match(theme, /\.manager-print-page/);
});

test('Maintenance previews the generated Auth email and retains its existing authorized rename', async () => {
  const html = await read('maintenance.html');
  const js = await read('pages/maintenance-page.js');
  assert.match(html, /accountAuthEmailPreview/);
  assert.match(js, /loginIdToEmail\(entered\)/);
  assert.match(js, /adminAccount\('rename_login'/);
  assert.equal(loginIdToEmail('patrol'), 'patrol@accounts.nightmemo.example.com');
  assert.doesNotMatch(html, /id="accountLogin"[^>]*placeholder=/);
});

test('manager accepts the shorter demo login without changing the existing Supabase identity', async () => {
  const auth = await read('services/auth-service.js');
  const entry = await read('pages/login-page.js');
  assert.match(entry, /manager: 'patrol'/);
  assert.match(auth, /expectedRole === 'manager' && account\.toLowerCase\(\) === 'patrol'/);
  assert.match(auth, /loginIdToEmail\('PatrolNight'\)/);
  assert.match(auth, /INSECURE_TEST_PASSWORDS && expectedRole === 'manager'/);
});
