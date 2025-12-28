const { Octokit } = require('octokit');

class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    this.owner = process.env.GITHUB_USERNAME;
  }

  async createStoryFile(repo, filename, content, message) {
    try {
      const response = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: repo,
        path: filename,
        message: message,
        content: Buffer.from(content).toString('base64'),
      });
      return { success: true, sha: response.data.content.sha };
    } catch (error) {
      console.error('Error creating file:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getStoryContent(repo, filename) {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: repo,
        path: filename,
      });
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return { success: true, content: content, sha: response.data.sha };
    } catch (error) {
      console.error('Error reading file:', error.message);
      return { success: false, error: error.message };
    }
  }

  async updateStoryFile(repo, filename, content, message, sha) {
    try {
      const response = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: repo,
        path: filename,
        message: message,
        content: Buffer.from(content).toString('base64'),
        sha: sha,
      });
      return { success: true, sha: response.data.content.sha };
    } catch (error) {
      console.error('Error updating file:', error.message);
      return { success: false, error: error.message };
    }
  }

  async checkRepoExists(repo) {
    try {
      await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: repo,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  generateFilename(title, storyId) {
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `story-${storyId}-${cleanTitle}.md`;
  }

  formatStoryContent(story, content = '') {
    return `# ${story.title}

**Genre:** ${story.genre}
**Language:** ${story.language}
**Created by:** ${story.creator}

## Theme
${story.theme}

${story.initial_plot ? `## Initial Plot
${story.initial_plot}

` : ''}---

## Story Content

${content}`;
  }
}

module.exports = GitHubService;