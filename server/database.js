import { randomUUID } from 'node:crypto'
import { readdir, readFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const serverDirectory = dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = join(serverDirectory, 'migrations')
const defaultDatabasePath = join(serverDirectory, 'data', 'chronologos.sqlite')

export const LOCAL_USER_ID = process.env.LOCAL_USER_ID || 'local-owner'
export const LOCAL_USER_NAME = process.env.LOCAL_USER_NAME || 'My Atlas'
export const databasePath = resolve(process.env.DATABASE_PATH || defaultDatabasePath)

export const defaultThemes = [
  { id: 'will', slug: 'will', name: 'İrade', color: '#ffc87c', center: [-0.36, 0.28, -0.89] },
  { id: 'memory', slug: 'memory', name: 'Bellek', color: '#fff1d1', center: [0.36, 0.29, -0.89] },
  { id: 'becoming', slug: 'becoming', name: 'Dönüşüm', color: '#f3a76c', center: [-0.37, -0.28, -0.89] },
  { id: 'kinship', slug: 'kinship', name: 'Yakınlık', color: '#b9dfe0', center: [0.37, -0.3, -0.88] },
]

export async function openDatabase() {
  await mkdir(dirname(databasePath), { recursive: true })
  const database = new DatabaseSync(databasePath)
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;
  `)

  const applied = new Set(database.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version))
  const migrationFiles = (await readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort()

  for (const filename of migrationFiles) {
    if (applied.has(filename)) continue
    const migration = await readFile(join(migrationsDirectory, filename), 'utf8')
    database.exec('BEGIN')
    try {
      database.exec(migration)
      database.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(filename)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      database.close()
      throw error
    }
  }

  database.prepare(`
    INSERT INTO users (id, display_name) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name
  `).run(LOCAL_USER_ID, LOCAL_USER_NAME)

  const insertTheme = database.prepare(`
    INSERT INTO themes (id, user_id, slug, name, color, center_x, center_y, center_z)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, slug) DO NOTHING
  `)
  for (const theme of defaultThemes) {
    insertTheme.run(theme.id, LOCAL_USER_ID, theme.slug, theme.name, theme.color, ...theme.center)
  }

  return database
}

function ensureAuthor(database, name) {
  const normalized = name.trim()
  const existing = database.prepare('SELECT id FROM authors WHERE name = ? COLLATE NOCASE').get(normalized)
  if (existing) return existing.id

  const id = randomUUID()
  database.prepare('INSERT INTO authors (id, name) VALUES (?, ?)').run(id, normalized)
  return id
}

export function seedDemoData(database) {
  const existingSeedCount = database.prepare('SELECT COUNT(*) AS count FROM library_entries WHERE is_demo = 1').get().count
  if (existingSeedCount > 0) return { inserted: 0, alreadySeeded: true }

  const examples = [
    {
      id: 'demo-meditations', title: 'Meditations', author: 'Marcus Aurelius', originalYear: 180,
      status: 'read', rating: 5, language: 'English', publisher: 'Penguin Classics', pageCount: 304,
    },
    {
      id: 'demo-ethics-of-ambiguity', title: 'The Ethics of Ambiguity', author: 'Simone de Beauvoir', originalYear: 1947,
      status: 'reading', language: 'English', publisher: 'Open Road Media', pageCount: 192,
    },
    {
      id: 'demo-invisible-cities', title: 'Invisible Cities', author: 'Italo Calvino', originalYear: 1972,
      status: 'to_read', language: 'English', publisher: 'Mariner Books', pageCount: 176,
    },
    {
      id: 'demo-devotions', title: 'Devotions', author: 'Mary Oliver', originalYear: 2017,
      status: 'paused', language: 'English', publisher: 'Penguin Press', pageCount: 480,
    },
  ]

  database.exec('BEGIN')
  try {
    const insertWork = database.prepare('INSERT INTO works (id, title, original_year) VALUES (?, ?, ?)')
    const linkAuthor = database.prepare('INSERT INTO work_authors (work_id, author_id) VALUES (?, ?)')
    const insertEdition = database.prepare(`
      INSERT INTO editions (id, work_id, language, publisher, page_count)
      VALUES (?, ?, ?, ?, ?)
    `)
    const insertEntry = database.prepare(`
      INSERT INTO library_entries (id, user_id, work_id, edition_id, status, rating, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `)

    for (const example of examples) {
      const workId = randomUUID()
      const editionId = randomUUID()
      insertWork.run(workId, example.title, example.originalYear)
      linkAuthor.run(workId, ensureAuthor(database, example.author))
      insertEdition.run(editionId, workId, example.language, example.publisher, example.pageCount)
      insertEntry.run(example.id, LOCAL_USER_ID, workId, editionId, example.status, example.rating ?? null)
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  return { inserted: examples.length, alreadySeeded: false }
}
