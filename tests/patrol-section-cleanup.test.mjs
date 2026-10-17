import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('Maintenance Ward configuration has no Patrol memo section UI', () => {
  const html = read('maintenance.html');
  assert.doesNotMatch(html, /Patrol memo section|Memo Section|mWardSection/);
  assert.match(html, /<th>Ward Name<\/th>/);
  assert.match(html, /<th>Empty-bed Gender<\/th>/);
});

test('Ward repository no longer models or filters by patrol section', () => {
  const repo = read('data/repositories/ward-repository.js');
  assert.match(repo, /export async function getWardsForDate\(date = defaultReportDate\(\)\)/);
  assert.doesNotMatch(repo, /patrol_section|section = null|ward\.patrol_section/);
  assert.match(repo, /return open;/);
});

test('runtime and demo sources contain no obsolete patrol_section field', () => {
  const files = [
    'maintenance.html',
    'pages/maintenance-page.js',
    'pages/maintenance-test-data.js',
    'pages/patrol-page.js',
    'pages/patrol-night-operations.js',
    'pages/ward-page.js',
    'data/repositories/ward-repository.js',
    'data/repositories/access-repository.js',
    'data/demo-state.js',
    'demo-data.js',
    'domain/demo-generator.js',
    'domain/patrol-memo.js',
    'domain/night-roster.js',
  ];
  const combined = files.map(file => `\n// ${file}\n${read(file)}`).join('\n');
  assert.doesNotMatch(combined, /patrol_section|mWardSection|Patrol memo section|Memo Section/);
});

test('fresh schema and seed no longer define a Patrol section', () => {
  const schema = read('supabase/schema.sql');
  const seed = read('supabase/seed.sql');
  const wardsBlock = schema.slice(schema.indexOf('create table if not exists public.wards'), schema.indexOf('create table if not exists public.ward_operating_periods'));
  assert.doesNotMatch(wardsBlock, /patrol_section/);
  assert.doesNotMatch(seed, /patrol_section/);
});

test('clean baseline has no obsolete Patrol section column or migration', () => {
  const schema = read('supabase/schema.sql');
  assert.doesNotMatch(schema, /patrol_section/);
});
