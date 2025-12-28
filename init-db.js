const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || './oola.db';
const db = new Database(dbPath);

console.log('🗄️  Initializing OOLA database...');

// Create Users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('author', 'reader', 'artist')),
    pen_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create Languages table
db.exec(`
  CREATE TABLE IF NOT EXISTS languages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    github_repo TEXT
  )
`);

// Insert default languages
const insertLanguage = db.prepare('INSERT OR IGNORE INTO languages (name, code, github_repo) VALUES (?, ?, ?)');
insertLanguage.run('English', 'en', process.env.REPO_ENGLISH || 'oola-stories-english');
insertLanguage.run('Tamil', 'ta', process.env.REPO_TAMIL || 'oola-stories-tamil');
insertLanguage.run('Spanish', 'es', process.env.REPO_SPANISH || 'oola-stories-spanish');
insertLanguage.run('French', 'fr', process.env.REPO_FRENCH || 'oola-stories-french');

// Create Genres table
db.exec(`
  CREATE TABLE IF NOT EXISTS genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  )
`);

// Insert default genres
const insertGenre = db.prepare('INSERT OR IGNORE INTO genres (name) VALUES (?)');
insertGenre.run('Fiction');
insertGenre.run('Non-Fiction');
insertGenre.run('Fantasy');
insertGenre.run('Science Fiction');
insertGenre.run('Mystery');
insertGenre.run('Romance');
insertGenre.run('Thriller');
insertGenre.run('Horror');

// Create Stories table
db.exec(`
  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    theme TEXT NOT NULL,
    initial_plot TEXT,
    language_id INTEGER NOT NULL,
    genre_id INTEGER NOT NULL,
    creator_id INTEGER NOT NULL,
    github_file_path TEXT,
    status TEXT DEFAULT 'available' CHECK(status IN ('available', 'checked_out', 'finished')),
    current_word_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (language_id) REFERENCES languages(id),
    FOREIGN KEY (genre_id) REFERENCES genres(id),
    FOREIGN KEY (creator_id) REFERENCES users(id)
  )
`);

// Create Story Contributors table (tracks all authors who contributed)
db.exec(`
  CREATE TABLE IF NOT EXISTS story_contributors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    contributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(story_id, user_id)
  )
`);

// Create Checkout Log table
db.exec(`
  CREATE TABLE IF NOT EXISTS checkout_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    checked_out_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checked_in_at DATETIME,
    auto_checkin BOOLEAN DEFAULT 0,
    words_added INTEGER DEFAULT 0,
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create Image Requests table
db.exec(`
  CREATE TABLE IF NOT EXISTS image_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    image_type TEXT CHECK(image_type IN ('scene', 'cover')),
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
    selected_submission_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )
`);

// Create Image Submissions table
db.exec(`
  CREATE TABLE IF NOT EXISTS image_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    artist_id INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES image_requests(id),
    FOREIGN KEY (artist_id) REFERENCES users(id)
  )
`);

console.log('✅ Database initialized successfully!');
console.log('📊 Tables created:');
console.log('   - users');
console.log('   - languages');
console.log('   - genres');
console.log('   - stories');
console.log('   - story_contributors');
console.log('   - checkout_log');
console.log('   - image_requests');
console.log('   - image_submissions');

db.close();
module.exports = db;