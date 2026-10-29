import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';

const fixture = resolve('agent-tasks/atlas-benchmark.sqlite');
const expectedFixture = resolve('C:/Users/fdagl/Documents/GitHub/Chronologos/agent-tasks/atlas-benchmark.sqlite');
if (fixture !== expectedFixture) throw new Error('Unexpected benchmark fixture path');
const tempRoot = await mkdtemp(join(tmpdir(), 'chronologos-archive-recovery-'));
if (!resolve(tempRoot).startsWith(resolve(tmpdir()) + sep) || !basename(tempRoot).startsWith('chronologos-archive-recovery-')) throw new Error('Unexpected temporary target');
const workingSourcePath = join(tempRoot, 'working-source.sqlite');
const snapshotPath = join(tempRoot, 'snapshot.sqlite');
const restoredPath = join(tempRoot, 'restored.sqlite');
const marker = 'archive-recovery-check-' + process.pid + '-' + Date.now();
let source;
let snapshot;
let restored;

function open(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function tableNames(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
}

function rowHash(db, tables) {
  const hash = createHash('sha256');
  for (const table of tables) {
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name);
    const order = columns.map((column) => `"${column}"`).join(', ');
    hash.update(`${table}\n`);
    for (const row of db.prepare(`SELECT * FROM "${table}" ORDER BY ${order}`).iterate()) {
      hash.update(JSON.stringify(columns.map((column) => row[column])) + '\n');
    }
  }
  return hash.digest('hex');
}

function counts(db, tables) {
  return Object.fromEntries(tables.map((table) => [table, db.prepare(`SELECT count(*) AS count FROM "${table}"`).get().count]));
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await copyFile(fixture, workingSourcePath);
  source = open(workingSourcePath);
  source.exec('PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0;');
  const tables = tableNames(source);
  for (const required of ['notes', 'note_links', 'atlas_nodes']) ensure(tables.includes(required), `Missing expected table: ${required}`);
  ensure(source.prepare('SELECT count(*) AS n FROM notes').get().n === 10000, 'Benchmark fixture must contain 10000 notes');
  ensure(source.prepare('SELECT count(*) AS n FROM note_links').get().n === 9999, 'Benchmark fixture must contain 9999 links');
  source.prepare('UPDATE notes SET content = ? WHERE id = ?').run(marker, 'bench-0');
  ensure(source.prepare('SELECT changes() AS n').get().n === 1, 'Expected one marker mutation');
  const walPath = `${workingSourcePath}-wal`;
  const walBytesBeforeBackup = (await stat(walPath)).size;
  ensure(walBytesBeforeBackup > 0, 'Expected uncheckpointed WAL bytes');
  const liveSourceHash = rowHash(source, tables);
  const liveSourceCounts = counts(source, tables);

  await backup(source, snapshotPath);
  source.close();
  source = undefined;
  snapshot = open(snapshotPath);
  const snapshotIntegrity = snapshot.prepare('PRAGMA integrity_check').all().map((row) => row.integrity_check);
  ensure(snapshotIntegrity.length === 1 && snapshotIntegrity[0] === 'ok', 'Snapshot integrity_check failed');
  snapshot.close();
  snapshot = undefined;
  await copyFile(snapshotPath, restoredPath);

  const badCopyPath = join(tempRoot, 'truncated.sqlite');
  const snapshotBytes = await readFile(snapshotPath);
  await writeFile(badCopyPath, snapshotBytes.subarray(0, Math.max(100, Math.floor(snapshotBytes.length / 2))));
  let truncatedRejected = false;
  let bad;
  try {
    bad = open(badCopyPath);
    const result = bad.prepare('PRAGMA integrity_check').all().map((row) => row.integrity_check);
    truncatedRejected = result.length !== 1 || result[0] !== 'ok';
  } catch {
    truncatedRejected = true;
  } finally {
    try { bad?.close(); } catch {}
  }
  ensure(truncatedRejected, 'Truncated snapshot copy unexpectedly passed integrity_check');

  restored = open(restoredPath);
  const integrity = restored.prepare('PRAGMA integrity_check').all().map((row) => row.integrity_check);
  ensure(integrity.length === 1 && integrity[0] === 'ok', 'Restored integrity_check failed');
  const foreignKeyViolations = restored.prepare('PRAGMA foreign_key_check').all();
  ensure(foreignKeyViolations.length === 0, 'Restored foreign_key_check reported violations');
  const countsByTable = counts(restored, tables);
  ensure(JSON.stringify(liveSourceCounts) === JSON.stringify(countsByTable), 'Application table counts differ from live source');
  ensure(countsByTable.notes === 10000 && countsByTable.note_links === 9999 && countsByTable.atlas_nodes === 10000, 'Restored application row counts differ');
  ensure(restored.prepare('SELECT content FROM notes WHERE id = ?').get('bench-0')?.content === marker, 'Recovery marker missing');
  const identities = restored.prepare(`
    SELECT n.id AS note_id, l.id AS link_id, l.source_note_id, l.target_note_id,
           a.note_id AS atlas_note_id, a.user_id AS atlas_user_id, n.user_id AS note_user_id
    FROM notes n
    JOIN atlas_nodes a ON a.note_id = n.id
    LEFT JOIN note_links l ON l.source_note_id = n.id
    WHERE n.id IN ('bench-0', 'bench-1') ORDER BY n.id, l.id LIMIT 4
  `).all();
  ensure(identities.length > 0 && identities.every((row) => row.note_id === row.atlas_note_id && row.note_user_id === row.atlas_user_id), 'Note/atlas identities or ownership do not match');
  ensure(identities.some((row) => row.link_id && row.source_note_id === row.note_id && row.target_note_id), 'Expected linked note identity was not preserved');

  const sourceForHash = open(snapshotPath);
  const snapshotHash = rowHash(sourceForHash, tables);
  sourceForHash.close();
  const restoredHash = rowHash(restored, tables);
  ensure(liveSourceHash === restoredHash, 'Restored rows differ from live source including WAL');
  ensure(snapshotHash === restoredHash, 'Restored deterministic application row hash differs from snapshot');
  const output = {
    status: 'passed',
    fixture: 'agent-tasks/atlas-benchmark.sqlite',
    method: 'node:sqlite backup(DatabaseSync, target) with live WAL writer',
    walBytesBeforeBackup,
    integrityCheck: integrity[0],
    foreignKeyViolations: foreignKeyViolations.length,
    applicationTableCount: tables.length,
    tableCounts: countsByTable,
    recoveryMarkerPreserved: true,
    deterministicApplicationRowsSha256: restoredHash,
    truncatedCopyRejected: true,
    scope: 'synthetic fixture verification only; no user-facing restore feature',
  };
  await writeFile(resolve('agent-tasks/archive-recovery-result.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output));
} finally {
  for (const db of [source, snapshot, restored]) {
    try { db?.close(); } catch {}
  }
  await rm(tempRoot, { recursive: true, force: true });
}
