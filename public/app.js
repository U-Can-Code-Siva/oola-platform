let currentUser = null;
let allStories = [];
let currentFilter = 'all';
let currentStoryId = null;
let currentStoryContent = '';

// Check if user is logged in on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            currentUser = await response.json();
            showApp();
            loadStories();
            loadLanguages();
            loadGenres();
            updateStats();
        }
    } catch (error) {
        console.log('Not logged in');
    }
});

// Auth Tab Switching
function showAuthTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.style.display = 'none');
    
    if (tab === 'login') {
        document.querySelector('.tab-btn:first-child').classList.add('active');
        document.getElementById('login-form').style.display = 'block';
    } else {
        document.querySelector('.tab-btn:last-child').classList.add('active');
        document.getElementById('register-form').style.display = 'block';
    }
}

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            showApp();
            loadStories();
            loadLanguages();
            loadGenres();
            updateStats();
        } else {
            document.getElementById('login-error').textContent = data.error;
        }
    } catch (error) {
        document.getElementById('login-error').textContent = 'Login failed';
    }
});

// Register
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const penName = document.getElementById('reg-penname').value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, role, penName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('register-error').textContent = '';
            alert('Account created! Please login.');
            showAuthTab('login');
            document.getElementById('register-form').reset();
        } else {
            document.getElementById('register-error').textContent = data.error;
        }
    } catch (error) {
        document.getElementById('register-error').textContent = 'Registration failed';
    }
});

// Logout
async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    document.getElementById('navbar').style.display = 'none';
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('login-page').classList.add('active');
}

// Show App
function showApp() {
    document.getElementById('navbar').style.display = 'block';
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('user-info').textContent = `👤 ${currentUser.penName || currentUser.username}`;
    showPage('home');
}

// Page Navigation
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    if (pageName === 'stories') {
        displayStories();
    }
}

// Load Stories
async function loadStories() {
    try {
        const response = await fetch('/api/stories');
        allStories = await response.json();
    } catch (error) {
        console.error('Failed to load stories:', error);
    }
}

// Update Stats
async function updateStats() {
    await loadStories();
    document.getElementById('total-stories').textContent = allStories.length;
    document.getElementById('available-stories').textContent = 
        allStories.filter(s => s.status === 'available').length;
    document.getElementById('finished-stories').textContent = 
        allStories.filter(s => s.status === 'finished').length;
}

// Filter Stories
function filterStories(status) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    displayStories();
}

// Display Stories
function displayStories() {
    const container = document.getElementById('stories-list');
    
    let filtered = allStories;
    if (currentFilter !== 'all') {
        filtered = allStories.filter(s => s.status === currentFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No stories found</p>';
        return;
    }
    
    container.innerHTML = filtered.map(story => `
        <div class="story-card" onclick="viewStory(${story.id})">
            <h3>${story.title}</h3>
            <div class="story-meta">
                <span>🌍 ${story.language_name}</span>
                <span>📚 ${story.genre_name}</span>
            </div>
            <p style="margin: 0.5rem 0; color: #666; font-size: 0.9rem;">
                ${story.theme.substring(0, 100)}${story.theme.length > 100 ? '...' : ''}
            </p>
            <p style="font-size: 0.85rem; color: #888;">
                by ${story.creator_pen_name || story.creator_name}
            </p>
            <span class="story-status status-${story.status}">
                ${story.status === 'available' ? '✅ Available' : 
                  story.status === 'checked_out' ? '🔒 In Progress' : 
                  '✨ Finished'}
            </span>
            ${story.current_word_count > 0 ? 
                `<p style="font-size: 0.85rem; color: #888; margin-top: 0.5rem;">
                    ${story.current_word_count} words
                </p>` : ''}
        </div>
    `).join('');
}

// View Story Detail
async function viewStory(storyId) {
    currentStoryId = storyId;
    
    try {
        const response = await fetch(`/api/stories/${storyId}`);
        const story = await response.json();
        
        // Get checkout status
        const statusResponse = await fetch(`/api/stories/${storyId}/checkout-status`);
        const checkoutStatus = await statusResponse.json();
        
        // Get contributors
        const contribResponse = await fetch(`/api/stories/${storyId}/contributors`);
        const contributors = await contribResponse.json();
        
        // Get story content
        const contentResponse = await fetch(`/api/stories/${storyId}/content`);
        const contentData = await contentResponse.json();
        
        // Display header
        document.getElementById('story-header').innerHTML = `
            <h1>${story.title}</h1>
            <div style="display: flex; gap: 2rem; margin-top: 1rem;">
                <span>🌍 ${story.language_name}</span>
                <span>📚 ${story.genre_name}</span>
                <span>✍️ by ${story.creator_pen_name || story.creator_name}</span>
            </div>
            <p style="margin-top: 1rem;"><strong>Theme:</strong> ${story.theme}</p>
            ${story.current_word_count > 0 ? 
                `<p><strong>Total Words:</strong> ${story.current_word_count}</p>` : ''}
        `;
        
        // Display action section
        let actionHtml = '';
        if (story.status === 'available' && currentUser.role === 'author') {
            actionHtml = `
                <button onclick="checkoutStory(${storyId})" class="checkout-btn">
                    ✍️ Check Out & Start Writing
                </button>
            `;
        } else if (checkoutStatus.checkedOut) {
            if (checkoutStatus.byCurrentUser) {
                actionHtml = `
                    <div class="checkout-info">
                        <p><strong>✅ You have checked out this story</strong></p>
                        <p>Expires: ${new Date(checkoutStatus.expiresAt).toLocaleString()}</p>
                        <button onclick="openEditor(${storyId})" class="checkout-btn" style="margin-top: 1rem;">
                            Continue Writing
                        </button>
                    </div>
                `;
            } else {
                actionHtml = `
                    <div class="checkout-info">
                        <p><strong>🔒 Currently checked out by ${checkoutStatus.checkedOutBy}</strong></p>
                        <p>Available after: ${new Date(checkoutStatus.expiresAt).toLocaleString()}</p>
                    </div>
                `;
            }
        } else if (story.status === 'finished') {
            actionHtml = '<p><strong>✨ This story is complete!</strong></p>';
        }
        
        document.getElementById('action-section').innerHTML = actionHtml;
        
        // Display contributors
        if (contributors.length > 0) {
            document.getElementById('story-contributors').innerHTML = `
                <h2>Contributors</h2>
                <div class="contributor-list">
                    ${contributors.map(c => `
                        <div class="contributor-card">
                            <span><strong>${c.pen_name || c.username}</strong></span>
                            <span>${c.total_words || 0} words</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            document.getElementById('story-contributors').innerHTML = '';
        }
        
        // Display content
        document.getElementById('story-text').textContent = contentData.content || 'No content yet.';
        
        showPage('story-detail');
    } catch (error) {
        console.error('Failed to load story:', error);
        alert('Failed to load story');
    }
}

// Checkout Story
async function checkoutStory(storyId) {
    try {
        const response = await fetch(`/api/stories/${storyId}/checkout`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(data.message);
            openEditor(storyId);
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to checkout story');
    }
}

// Open Editor
async function openEditor(storyId) {
    currentStoryId = storyId;
    
    try {
        const response = await fetch(`/api/stories/${storyId}`);
        const story = await response.json();
        
        const contentResponse = await fetch(`/api/stories/${storyId}/content`);
        const contentData = await contentResponse.json();
        currentStoryContent = contentData.content;
        
        const statusResponse = await fetch(`/api/stories/${storyId}/checkout-status`);
        const checkoutStatus = await statusResponse.json();
        
        document.getElementById('editor-story-title').textContent = story.title;
        document.getElementById('editor-expires').textContent = 
            `⏰ Checkout expires: ${new Date(checkoutStatus.expiresAt).toLocaleString()}`;
        
        document.getElementById('current-story-content').textContent = currentStoryContent;
        document.getElementById('contribution-text').value = '';
        document.getElementById('contribution-word-count').textContent = '0';
        document.getElementById('word-count-status').textContent = '';
        
        showPage('editor');
    } catch (error) {
        alert('Failed to open editor');
    }
}

// Word Counter for Contribution
document.getElementById('contribution-text')?.addEventListener('input', (e) => {
    const text = e.target.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const minWords = 50;
    const maxWords = 1312;
    
    document.getElementById('contribution-word-count').textContent = words;
    
    const statusEl = document.getElementById('word-count-status');
    if (words === 0) {
        statusEl.textContent = '';
        statusEl.className = 'word-status';
    } else if (words < minWords) {
        statusEl.textContent = `Need ${minWords - words} more words (min: ${minWords})`;
        statusEl.className = 'word-status invalid';
    } else if (words > maxWords) {
        statusEl.textContent = `${words - maxWords} words over limit (max: ${maxWords})`;
        statusEl.className = 'word-status invalid';
    } else {
        statusEl.textContent = '✓ Word count valid';
        statusEl.className = 'word-status valid';
    }
});

// Submit Contribution
async function submitContribution() {
    const content = document.getElementById('contribution-text').value.trim();
    
    if (!content) {
        alert('Please write your contribution');
        return;
    }
    
    const words = content.split(/\s+/).length;
    const minWords = 50;
    const maxWords = 1312;
    
    if (words < minWords || words > maxWords) {
        alert(`Word count must be between ${minWords} and ${maxWords}. You have ${words} words.`);
        return;
    }
    
    try {
        const response = await fetch(`/api/stories/${currentStoryId}/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('editor-success').textContent = data.message;
            document.getElementById('editor-error').textContent = '';
            
            setTimeout(() => {
                loadStories();
                updateStats();
                viewStory(currentStoryId);
            }, 2000);
        } else {
            document.getElementById('editor-error').textContent = data.error;
            document.getElementById('editor-success').textContent = '';
        }
    } catch (error) {
        document.getElementById('editor-error').textContent = 'Failed to submit contribution';
    }
}

// Cancel Edit
function cancelEdit() {
    if (confirm('Are you sure you want to cancel? Your changes will be lost.')) {
        viewStory(currentStoryId);
    }
}

// Load Languages
async function loadLanguages() {
    try {
        const response = await fetch('/api/languages');
        const languages = await response.json();
        const select = document.getElementById('story-language');
        select.innerHTML = '<option value="">Select Language</option>' + 
            languages.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    } catch (error) {
        console.error('Failed to load languages:', error);
    }
}

// Load Genres
async function loadGenres() {
    try {
        const response = await fetch('/api/genres');
        const genres = await response.json();
        const select = document.getElementById('story-genre');
        select.innerHTML = '<option value="">Select Genre</option>' + 
            genres.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (error) {
        console.error('Failed to load genres:', error);
    }
}

// Word Counter
document.getElementById('story-plot').addEventListener('input', (e) => {
    const text = e.target.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    document.getElementById('plot-word-count').textContent = words;
});

// Create Story
document.getElementById('create-story-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('story-title').value;
    const languageId = document.getElementById('story-language').value;
    const genreId = document.getElementById('story-genre').value;
    const theme = document.getElementById('story-theme').value;
    const initialPlot = document.getElementById('story-plot').value;
    
    try {
        const response = await fetch('/api/stories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, theme, initialPlot, languageId, genreId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('create-success').textContent = data.message;
            document.getElementById('create-error').textContent = '';
            document.getElementById('create-story-form').reset();
            document.getElementById('plot-word-count').textContent = '0';
            
            setTimeout(() => {
                loadStories();
                updateStats();
                showPage('stories');
            }, 2000);
        } else {
            document.getElementById('create-error').textContent = data.error;
            document.getElementById('create-success').textContent = '';
        }
    } catch (error) {
        document.getElementById('create-error').textContent = 'Failed to create story';
        document.getElementById('create-success').textContent = '';
    }
});
