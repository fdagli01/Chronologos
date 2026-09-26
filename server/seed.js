import { openDatabase, seedDemoData, defaultThemes, LOCAL_USER_ID } from './database.js'
import { randomUUID } from 'node:crypto'

function seedDemoNotes(database) {
  if (database.prepare('SELECT COUNT(*) AS count FROM notes WHERE is_demo = 1 AND user_id = ?').get(LOCAL_USER_ID).count) {
    return 0
  }
  const examples = [
    { id: 'demo-thought-agency', bookId: 'demo-meditations', theme: 'will', title: 'Agency and attention', content: 'What remains within my control is shaped by the attention I give it.', commentary: 'A personal reflection on agency, not a quotation from the book.' },
    { id: 'demo-thought-ambiguity', bookId: 'demo-ethics-of-ambiguity', theme: 'becoming', title: 'Freedom as a practice', content: 'Freedom becomes concrete through the choices that make room for another person.', commentary: 'A note to revisit alongside the book’s discussion of ambiguity.' },
    { id: 'demo-thought-cities', bookId: 'demo-invisible-cities', theme: 'memory', title: 'Cities as remembered worlds', content: 'A place can be rebuilt from the fragments that attention chooses to keep.', commentary: 'An original reading note inspired by the structure of the book.' },
    { id: 'demo-thought-devotions', bookId: 'demo-devotions', theme: 'kinship', title: 'Attention as kinship', content: 'Care begins when the world is allowed to appear in its own particularity.', commentary: 'A personal thought about attention and relation.' },
  ]
  const byId = new Map(defaultThemes.map((theme) => [theme.id, theme]))
  const insertNote = database.prepare(`INSERT INTO notes (id, user_id, library_entry_id, edition_id, kind, title, content, commentary, is_demo)
    SELECT ?, ?, entry.id, entry.edition_id, 'thought', ?, ?, ?, 1 FROM library_entries entry WHERE entry.id = ? AND entry.user_id = ?`)
  const insertTheme = database.prepare('INSERT INTO note_themes (note_id, theme_id) VALUES (?, ?)')
  const insertNode = database.prepare(`INSERT INTO atlas_nodes (note_id, user_id, primary_theme_id, x, y, z, magnitude, phase, layout_seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertEvent = database.prepare(`INSERT INTO atlas_events (user_id, event_type, note_id, theme_id) VALUES (?, 'note_created', ?, ?)`)
  database.exec('BEGIN')
  try {
    for (let index = 0; index < examples.length; index += 1) {
      const note = examples[index]
      const theme = byId.get(note.theme)
      const unit = theme.center.map((value) => value / Math.hypot(...theme.center))
      const tangent = [unit[2], 0, -unit[0]]
      const bitangent = [unit[1] * tangent[2] - unit[2] * tangent[1], unit[2] * tangent[0] - unit[0] * tangent[2], unit[0] * tangent[1] - unit[1] * tangent[0]]
      const a = (index - 1.5) * 0.055
      const b = ((index % 2) ? 1 : -1) * 0.04
      const pos = unit.map((value, axis) => value + tangent[axis] * a + bitangent[axis] * b)
      const length = Math.hypot(...pos)
      const xyz = pos.map((value) => value / length * 21.5)
      const result = insertNote.run(note.id, LOCAL_USER_ID, note.title, note.content, note.commentary, note.bookId, LOCAL_USER_ID)
      if (!result.changes) continue
      insertTheme.run(note.id, theme.id)
      insertNode.run(note.id, LOCAL_USER_ID, theme.id, ...xyz, 2.9, index * 1.71, 4000 + index)
      insertEvent.run(LOCAL_USER_ID, note.id, theme.id)
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return examples.length
}

const database = await openDatabase()
try {
  const result = seedDemoData(database)
  const thoughts = seedDemoNotes(database)
  console.log(`Seed complete: ${result.inserted} demo books and ${thoughts} original sample notes added${result.alreadySeeded && !thoughts ? '; existing demo data left unchanged' : '.'}`)
} finally {
  database.close()
}
