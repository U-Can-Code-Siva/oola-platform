require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const GitHubService = require('./github-service');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
const dbPath = process.env.DB_PATH || './oola.db';
let db;

try {
  db = new Database(dbPath);
  console.log('✅ Database connected');
  
  // Run initialization
  require('./init-db');
} catch (error) {
  console.error('❌ Database error:', error);
  process.exit(1);
}

// Initialize GitHub service
const githubService = new GitHubService();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'oola-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// ===== AUTH ROUTES =====

app.post('/api/register', async (req, res) => {
  const { username, email, password, role, penName } = req.body;
  
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, pen_name)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(username, email, passwordHash, role, penName || null);
    
    res.json({ 
      success: true, 
      userId: result.lastInsertRowid,
      message: 'Account created successfully!' 
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    
    res.json({ 
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        penName: user.pen_name
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, email, role, pen_name FROM users WHERE id = ?')
    .get(req.session.userId);
  res.json(user);
});

// ===== LANGUAGE & GENRE ROUTES =====

app.get('/api/languages', (req, res) => {
  const languages = db.prepare('SELECT * FROM languages').all();
  res.json(languages);
});

app.get('/api/genres', (req, res) => {
  const genres = db.prepare('SELECT * FROM genres').all();
  res.json(genres);
});

// ===== STORY ROUTES =====

app.post('/api/stories', requireAuth, async (req, res) => {
  const { title, theme, initialPlot, languageId, genreId } = req.body;
  
  if (!title || !theme || !languageId || !genreId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get language and genre info
    const language = db.prepare('SELECT * FROM languages WHERE id = ?').get(languageId);
    const genre = db.prepare('SELECT * FROM genres WHERE id = ?').get(genreId);
    const user = db.prepare('SELECT username, pen_name FROM users WHERE id = ?').get(req.session.userId);
    
    // Insert story
    const stmt = db.prepare(`
      INSERT INTO stories (title, theme, initial_plot, language_id, genre_id, creator_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'available')
    `);
    
    const result = stmt.run(title, theme, initialPlot || '', languageId, genreId, req.session.userId);
    const storyId = result.lastInsertRowid;
    
    // Generate filename
    const filename = githubService.generateFilename(title, storyId);
    
    // Create initial content
    const storyData = {
      title,
      theme,
      initial_plot: initialPlot,
      genre: genre.name,
      language: language.name,
      creator: user.pen_name || user.username
    };
    
    const content = githubService.formatStoryContent(storyData, initialPlot || '');
    
    // Create file in GitHub
    const githubResult = await githubService.createStoryFile(
      language.github_repo,
      filename,
      content,
      `Initial commit: ${title}`
    );
    
    if (githubResult.success) {
      // Update story with GitHub path
      db.prepare('UPDATE stories SET github_file_path = ? WHERE id = ?')
        .run(filename, storyId);
      
      res.json({ 
        success: true, 
        storyId: storyId,
        message: 'Story created successfully!' 
      });
    } else {
      // Rollback: delete story if GitHub fails
      db.prepare('DELETE FROM stories WHERE id = ?').run(storyId);
      res.status(500).json({ error: 'Failed to create story in GitHub: ' + githubResult.error });
    }
  } catch (error) {
    console.error('Story creation error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

app.get('/api/stories', (req, res) => {
  const { status } = req.query;
  
  let query = `
    SELECT 
      s.*,
      l.name as language_name,
      g.name as genre_name,
      u.username as creator_name,
      u.pen_name as creator_pen_name
    FROM stories s
    JOIN languages l ON s.language_id = l.id
    JOIN genres g ON s.genre_id = g.id
    JOIN users u ON s.creator_id = u.id
  `;
  
  if (status) {
    query += ' WHERE s.status = ?';
    const stories = db.prepare(query).all(status);
    return res.json(stories);
  }
  
  const stories = db.prepare(query).all();
  res.json(stories);
});

app.get('/api/stories/:id', (req, res) => {
  const story = db.prepare(`
    SELECT 
      s.*,
      l.name as language_name,
      l.github_repo,
      g.name as genre_name,
      u.username as creator_name,
      u.pen_name as creator_pen_name
    FROM stories s
    JOIN languages l ON s.language_id = l.id
    JOIN genres g ON s.genre_id = g.id
    JOIN users u ON s.creator_id = u.id
    WHERE s.id = ?
  `).get(req.params.id);
  
  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }
  
  res.json(story);
});

// ===== CHECKOUT ROUTES (Phase 2 - Coming Soon) =====

app.post('/api/stories/:id/checkout', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Checkout feature coming in Phase 2!' });
});

app.post('/api/stories/:id/checkin', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Check-in feature coming in Phase 2!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  🚀 OOLA Platform is running!
  📍 URL: http://localhost:${PORT}
  🗄️  Database: ${dbPath}
  🐙 GitHub: Ready
  
  Phase 1 Features Active:
  ✅ User Registration & Login
  ✅ Story Creation
  ✅ Story Listing
  ✅ GitHub Integration
  
  🔜 Phase 2 Coming: Check-out/Check-in workflow
  `);
});
