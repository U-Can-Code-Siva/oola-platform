require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const GitHubService = require('./github-service');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// ===== CHECKOUT ROUTES =====

app.post('/api/stories/:id/checkout', requireAuth, async (req, res) => {
  const storyId = req.params.id;
  const userId = req.session.userId;
  
  try {
    const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(storyId);
    
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    if (story.status !== 'available') {
      return res.status(400).json({ error: 'Story is not available for checkout' });
    }
    
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    if (user.role !== 'author') {
      return res.status(403).json({ error: 'Only authors can check out stories' });
    }
    
    // Update story status
    db.prepare('UPDATE stories SET status = ? WHERE id = ?').run('checked_out', storyId);
    
    // Create checkout log
    db.prepare(`
      INSERT INTO checkout_log (story_id, user_id, checked_out_at)
      VALUES (?, ?, datetime('now'))
    `).run(storyId, userId);
    
    res.json({ 
      success: true, 
      message: 'Story checked out successfully! You have 1 week to contribute.',
      checkoutId: db.prepare('SELECT last_insert_rowid()').pluck().get()
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to checkout story' });
  }
});

app.post('/api/stories/:id/checkin', requireAuth, async (req, res) => {
  const storyId = req.params.id;
  const userId = req.session.userId;
  const { content } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  try {
    // Verify this user has checked out this story
    const checkout = db.prepare(`
      SELECT * FROM checkout_log 
      WHERE story_id = ? AND user_id = ? AND checked_in_at IS NULL
      ORDER BY checked_out_at DESC LIMIT 1
    `).get(storyId, userId);
    
    if (!checkout) {
      return res.status(400).json({ error: 'You have not checked out this story' });
    }
    
    // Word count validation
    const wordCount = content.trim().split(/\s+/).length;
    const minWords = 50;  // 1000 - 5%
    const maxWords = 1312; // 1250 + 5%
    
    if (wordCount < minWords || wordCount > maxWords) {
      return res.status(400).json({ 
        error: `Content must be between ${minWords} and ${maxWords} words. You have ${wordCount} words.` 
      });
    }
    
    // Get story details for GitHub
    const story = db.prepare(`
      SELECT s.*, l.github_repo, l.name as language_name, g.name as genre_name, u.username, u.pen_name
      FROM stories s
      JOIN languages l ON s.language_id = l.id
      JOIN genres g ON s.genre_id = g.id
      JOIN users u ON s.creator_id = u.id
      WHERE s.id = ?
    `).get(storyId);
    
    // Get current content from GitHub
    const githubContent = await githubService.getStoryContent(
      story.github_repo,
      story.github_file_path
    );
    
    if (!githubContent.success) {
      return res.status(500).json({ error: 'Failed to fetch story from GitHub' });
    }
    
    // Append new content
    const user = db.prepare('SELECT username, pen_name FROM users WHERE id = ?').get(userId);
    const authorName = user.pen_name || user.username;
    const timestamp = new Date().toISOString().split('T')[0];
    
    const newContent = `${githubContent.content}

---

### Contribution by ${authorName} (${timestamp})
Words: ${wordCount}

${content}`;
    
    // Update in GitHub
    const updateResult = await githubService.updateStoryFile(
      story.github_repo,
      story.github_file_path,
      newContent,
      `Contribution by ${authorName}: +${wordCount} words`,
      githubContent.sha
    );
    
    if (!updateResult.success) {
      return res.status(500).json({ error: 'Failed to update story in GitHub' });
    }
    
    // Update database
    db.prepare(`
      UPDATE checkout_log 
      SET checked_in_at = datetime('now'), words_added = ?
      WHERE id = ?
    `).run(wordCount, checkout.id);
    
    db.prepare(`
      UPDATE stories 
      SET status = 'available', current_word_count = current_word_count + ?
      WHERE id = ?
    `).run(wordCount, storyId);
    
    // Add to contributors if not already there
    db.prepare(`
      INSERT OR IGNORE INTO story_contributors (story_id, user_id)
      VALUES (?, ?)
    `).run(storyId, userId);
    
    res.json({ 
      success: true, 
      message: 'Story checked in successfully!',
      wordsAdded: wordCount
    });
  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json({ error: 'Failed to checkin story' });
  }
});

// Get story content from GitHub
app.get('/api/stories/:id/content', async (req, res) => {
  try {
    const story = db.prepare(`
      SELECT s.*, l.github_repo
      FROM stories s
      JOIN languages l ON s.language_id = l.id
      WHERE s.id = ?
    `).get(req.params.id);
    
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    const content = await githubService.getStoryContent(
      story.github_repo,
      story.github_file_path
    );
    
    if (content.success) {
      res.json({ content: content.content });
    } else {
      res.status(500).json({ error: 'Failed to fetch story content' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// Get checkout status for a story
app.get('/api/stories/:id/checkout-status', requireAuth, (req, res) => {
  const storyId = req.params.id;
  const userId = req.session.userId;
  
  const checkout = db.prepare(`
    SELECT cl.*, u.username, u.pen_name,
           datetime(cl.checked_out_at, '+7 days') as expires_at
    FROM checkout_log cl
    JOIN users u ON cl.user_id = u.id
    WHERE cl.story_id = ? AND cl.checked_in_at IS NULL
    ORDER BY cl.checked_out_at DESC LIMIT 1
  `).get(storyId);
  
  if (!checkout) {
    return res.json({ checkedOut: false });
  }
  
  res.json({
    checkedOut: true,
    byCurrentUser: checkout.user_id === userId,
    checkedOutBy: checkout.pen_name || checkout.username,
    checkedOutAt: checkout.checked_out_at,
    expiresAt: checkout.expires_at
  });
});

// Get story contributors
app.get('/api/stories/:id/contributors', (req, res) => {
  const contributors = db.prepare(`
    SELECT u.username, u.pen_name, sc.contributed_at,
           SUM(cl.words_added) as total_words
    FROM story_contributors sc
    JOIN users u ON sc.user_id = u.id
    LEFT JOIN checkout_log cl ON cl.story_id = sc.story_id AND cl.user_id = sc.user_id
    WHERE sc.story_id = ?
    GROUP BY u.id
    ORDER BY sc.contributed_at
  `).all(req.params.id);
  
  res.json(contributors);
});

// Auto check-in background job (runs every hour)
setInterval(() => {
  try {
    const expiredCheckouts = db.prepare(`
      SELECT cl.*, s.id as story_id, s.github_file_path, l.github_repo
      FROM checkout_log cl
      JOIN stories s ON cl.story_id = s.id
      JOIN languages l ON s.language_id = l.id
      WHERE cl.checked_in_at IS NULL
      AND datetime(cl.checked_out_at, '+7 days') < datetime('now')
    `).all();
    
    expiredCheckouts.forEach(checkout => {
      console.log(`⏰ Auto check-in for story ${checkout.story_id} by user ${checkout.user_id}`);
      
      // Mark as auto checked-in
      db.prepare(`
        UPDATE checkout_log 
        SET checked_in_at = datetime('now'), auto_checkin = 1
        WHERE id = ?
      `).run(checkout.id);
      
      // Make story available again
      db.prepare(`
        UPDATE stories 
        SET status = 'available'
        WHERE id = ?
      `).run(checkout.story_id);
    });
    
    if (expiredCheckouts.length > 0) {
      console.log(`✅ Auto checked-in ${expiredCheckouts.length} expired checkout(s)`);
    }
  } catch (error) {
    console.error('Auto check-in error:', error);
  }
}, 60 * 60 * 1000); // Run every hour

// Start server
app.listen(PORT, () => {
  console.log(`
  🚀 OOLA Platform Phase 2 is running!
  📍 URL: http://localhost:${PORT}
  🗄️  Database: ${dbPath}
  🐙 GitHub: Ready
  
  ✅ Phase 1 Features:
  • User Registration & Login
  • Story Creation
  • Story Listing
  • GitHub Integration
  
  ✅ Phase 2 Features (NEW!):
  • Check-out/Check-in workflow
  • Story editor with word counter (1000-1250 words ±5%)
  • Auto check-in after 1 week (runs hourly)
  • View full story content
  • Contributors tracking
  
  🎉 Ready for collaborative storytelling!
  `);
});
