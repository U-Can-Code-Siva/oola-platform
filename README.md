# OOLA - Collaborative Story Platform

## 🚀 Quick Start Guide

### Prerequisites
- Docker v4.55+ ✅ (You have this!)
- GitHub account
- GitHub Personal Access Token

### Step 1: Get Your GitHub Token

1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name: `OOLA-Local-Dev`
4. Select these permissions:
   - ✅ `repo` (all repo permissions)
   - ✅ `workflow`
5. Click "Generate token"
6. **COPY THE TOKEN** (you'll only see it once!)

### Step 2: Project Setup

Create a project folder and save all the files I'm providing:

```bash
mkdir oola-platform
cd oola-platform
```

You'll need these files (I'm providing them next):
- `docker-compose.yml`
- `Dockerfile`
- `.env.example`
- `package.json`
- `server.js`
- `init-db.js`
- `github-service.js`
- `public/index.html`
- `public/styles.css`
- `public/app.js`

### Step 3: Configure Environment

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` and add your GitHub token:
```
GITHUB_TOKEN=your_token_here
GITHUB_USERNAME=your_github_username
```

### Step 4: Run the Application

```bash
docker-compose up --build
```

That's it! The application will start at: **http://localhost:3000**

### Step 5: First Time Setup

1. Create a GitHub repository for each language you want to support:
   - Example: `oola-stories-english`
   - Example: `oola-stories-tamil`
2. Make them public or private (your choice)
3. Initialize with a README

### Stopping the Application

```bash
docker-compose down
```

### Viewing Logs

```bash
docker-compose logs -f
```

---

## 🎯 What's Working in Phase 1

✅ User Registration (Author, Reader, Artist roles)
✅ User Login/Authentication
✅ Create New Story (with theme/plot)
✅ List All Stories (Available, Checked-out, Finished)
✅ SQLite Database (auto-created)
✅ GitHub Integration (ready for check-out/check-in)

## 🔜 Coming Next (Phase 2)

- Check-out/Check-in workflow
- Story editor with word counter
- Auto check-in after 1 week
- Image upload and artist workflow
- Search functionality

---

## 📁 Project Structure

```
oola-platform/
├── docker-compose.yml       # Docker orchestration
├── Dockerfile              # Container definition
├── .env                    # Your secrets (DO NOT COMMIT)
├── .env.example           # Template for .env
├── package.json           # Node.js dependencies
├── server.js             # Main application server
├── init-db.js           # Database initialization
├── github-service.js    # GitHub API integration
└── public/              # Frontend files
    ├── index.html
    ├── styles.css
    └── app.js
```

---

## 🆘 Troubleshooting

**Port 3000 already in use?**
```bash
# Stop whatever is using port 3000, or change it in docker-compose.yml
```

**GitHub API errors?**
- Check your token has correct permissions
- Verify token in .env file
- Make sure repository exists

**Database errors?**
- Delete `oola.db` file and restart
- Check file permissions

---

## 💡 Tips

- Keep your GitHub token SECRET
- Don't commit `.env` file to version control
- Database file `oola.db` will be created automatically
- All data persists between restarts

Ready to rock? Let's build stories together! 📚✨