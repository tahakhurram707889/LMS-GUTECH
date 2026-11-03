import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migrationFiles = readdirSync(new URL('../supabase/migrations/', import.meta.url)).sort();
const sql = migrationFiles.map((file) => read(`supabase/migrations/${file}`)).join('\n');
const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);

test('all 18 public tables explicitly enable RLS and have created_at', () => {
  assert.equal(tables.length, 18);
  for (const table of tables) {
    assert.ok(sql.includes(`alter table public.${table} enable row level security;`), table);
    const definition = sql.match(new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`));
    assert.match(definition?.[1] ?? '', /created_at timestamptz/, table);
  }
});
test('the marks view uses caller privileges, and keys are isolated from questions', () => {
  assert.match(sql, /v_student_marks with \(security_invoker = true\)/);
  assert.match(sql, /create table public\.quiz_answers/);
  assert.match(sql, /create policy answers_staff_only[\s\S]*?can_manage_course/);
  assert.doesNotMatch(sql, /grant (?:insert|update|all).*?public\.(?:submissions|quiz_attempts).*?to authenticated/i);
});
test('public signup is disabled and storage buckets are private', () => {
  const config = read('supabase/config.toml');
  assert.equal([...config.matchAll(/enable_signup = false/g)].length, 2);
  for (const bucket of ['resources', 'submissions', 'complaint-attachments']) {
    assert.ok(sql.includes(`('${bucket}','${bucket}',false,`));
  }
});
test('frontend configuration cannot contain a service-role variable', () => {
  for (const file of ['frontend/.env.example', 'frontend/.env']) {
    if (file.endsWith('/.env') && !existsSync(new URL(`../${file}`, import.meta.url))) continue;
    assert.doesNotMatch(read(file), /^\s*(?:VITE_)?SUPABASE_SERVICE_ROLE_KEY\s*=/m);
  }
});
test('all security-definer helpers fix the search path', () => {
  const functions = [...sql.matchAll(/create function[\s\S]*?\$\$;/g)].map((match) => match[0]);
  for (const fn of functions.filter((text) => text.includes('security definer'))) {
    assert.match(fn, /set search_path\s*=\s*''/);
  }
});
