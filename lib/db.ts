import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(process.cwd(), '.poker-data')
const DB_PATH = process.env.DB_PATH ?? path.join(DB_DIR, 'poker.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  return db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    UNIQUE NOT NULL,
      password     TEXT    NOT NULL,
      created_at   TEXT    DEFAULT (datetime('now')),
      chips_total  INTEGER DEFAULT 0,
      games_played INTEGER DEFAULT 0,
      games_won    INTEGER DEFAULT 0,
      hands_played INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS game_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      won          INTEGER NOT NULL,
      hands_played INTEGER NOT NULL DEFAULT 0,
      chips_delta  INTEGER NOT NULL DEFAULT 0,
      played_at    TEXT    DEFAULT (datetime('now'))
    );
  `)
}

export interface User {
  id: number
  username: string
  password: string
  created_at: string
  chips_total: number
  games_played: number
  games_won: number
  hands_played: number
}

export interface LeaderboardEntry {
  username: string
  chips_total: number
  games_played: number
  games_won: number
  win_rate: number
}

export function createUser(username: string, hashedPassword: string): User {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO users (username, password) VALUES (?, ?) RETURNING *'
  )
  return stmt.get(username, hashedPassword) as User
}

export function getUserByUsername(username: string): User | null {
  const db = getDb()
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | null
}

export function getUserById(id: number): User | null {
  const db = getDb()
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | null
}

export function recordGameResult(
  userId: number,
  won: boolean,
  handsPlayed: number,
  chipsDelta: number,
) {
  const db = getDb()
  db.prepare(
    'INSERT INTO game_history (user_id, won, hands_played, chips_delta) VALUES (?, ?, ?, ?)'
  ).run(userId, won ? 1 : 0, handsPlayed, chipsDelta)

  db.prepare(`
    UPDATE users SET
      games_played = games_played + 1,
      games_won    = games_won + ?,
      hands_played = hands_played + ?,
      chips_total  = chips_total + ?
    WHERE id = ?
  `).run(won ? 1 : 0, handsPlayed, chipsDelta, userId)
}

export function getLeaderboard(): LeaderboardEntry[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      username,
      chips_total,
      games_played,
      games_won,
      CASE WHEN games_played > 0
        THEN ROUND(games_won * 100.0 / games_played, 1)
        ELSE 0
      END as win_rate
    FROM users
    ORDER BY chips_total DESC
    LIMIT 20
  `).all() as LeaderboardEntry[]
}
