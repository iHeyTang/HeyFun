import { Octokit } from '@octokit/rest';
import { to } from '../shared/to';

interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

interface NPMPackageInfo {
  name: string;
}

export interface RepositoryMetadata {
  readme?: string;
  stars?: number;
  downloads?: number;
  version?: string;
  license?: string;
  author?: string;
  lastUpdated?: Date;
  logoUrl?: string;
  category?: string;
  tags?: string[];
  capabilities?: string[];
}

export class ReadmeFetcher {
  private octokit: Octokit;

  constructor(githubToken?: string) {
    this.octokit = new Octokit({
      auth: githubToken || process.env.GITHUB_TOKEN || '',
    });
  }

  /**
   * Parse GitHub repository URL to extract owner and repo name
   */
  private parseGitHubUrl(url: string): GitHubRepoInfo | null {
    const githubRegex = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/;
    const match = url.match(githubRegex);

    if (!match) return null;

    return {
      owner: match[1]!,
      repo: match[2]!,
    };
  }

  /**
   * Parse npm package URL to extract package name
   */
  private parseNpmUrl(url: string): NPMPackageInfo | null {
    const npmRegex = /^https?:\/\/(?:www\.)?npmjs\.com\/package\/([^\/]+)/;
    const match = url.match(npmRegex);

    if (!match) return null;

    return {
      name: match[1]!,
    };
  }

  /**
   * Fetch repository metadata from GitHub
   */
  async fetchGitHubMetadata(repoUrl: string): Promise<RepositoryMetadata> {
    const repoInfo = this.parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      throw new Error('Invalid GitHub URL');
    }

    try {
      // Fetch repository information
      const { data: repo } = await this.octokit.repos.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
      });

      // Fetch README content
      let readme: string | undefined;
      try {
        const { data: readmeData } = await this.octokit.repos.getReadme({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
        });

        if (readmeData.content) {
          readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
        }
      } catch {
        console.log('README not found or not accessible');
      }

      // Try to get package.json for additional metadata
      const [packageInfoError, packageInfo] = await to(async () => {
        const { data: packageData } = await this.octokit.repos.getContent({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          path: 'package.json',
        });

        if ('content' in packageData && packageData.content) {
          const packageJson = JSON.parse(Buffer.from(packageData.content, 'base64').toString('utf-8'));
          return packageJson;
        }
        return {};
      });

      if (packageInfoError) {
        console.error('Error fetching package.json:', packageInfoError);
      }

      // Extract MCP capabilities from package.json or README
      const capabilities = this.extractMCPCapabilities(packageInfo || {}, readme);
      const tags = this.extractTags(repo, packageInfo || {}, readme);

      return {
        readme,
        stars: repo.stargazers_count,
        version: packageInfo?.version,
        license: repo.license?.spdx_id || packageInfo?.license,
        author: packageInfo?.author?.name || repo.owner.login,
        lastUpdated: new Date(repo.updated_at),
        logoUrl: this.extractLogoUrl(packageInfo || {}, readme),
        category: this.categorizeRepository(repo, packageInfo || {}, readme),
        tags,
        capabilities,
      };
    } catch (error) {
      console.error('Error fetching GitHub metadata:', error);
      throw new Error('Failed to fetch repository metadata');
    }
  }

  /**
   * Fetch package metadata from npm registry
   */
  async fetchNpmMetadata(packageUrl: string): Promise<RepositoryMetadata> {
    const packageInfo = this.parseNpmUrl(packageUrl);
    if (!packageInfo) {
      throw new Error('Invalid npm package URL');
    }

    try {
      const response = await fetch(`https://registry.npmjs.org/${packageInfo.name}`);
      if (!response.ok) {
        throw new Error('Package not found on npm');
      }

      const data = await response.json();
      const latestVersion = data['dist-tags']?.latest || Object.keys(data.versions || {}).pop();
      const versionData = data.versions?.[latestVersion] || {};

      // Fetch download statistics
      const downloadsResponse = await fetch(`https://api.npmjs.org/downloads/point/last-month/${packageInfo.name}`);
      const downloadsData = downloadsResponse.ok ? await downloadsResponse.json() : null;

      // Try to fetch README from GitHub if repository is available
      let githubMetadata: Partial<RepositoryMetadata> = {};
      if (versionData.repository?.url) {
        try {
          const gitHubUrl = this.normalizeGitHubUrl(versionData.repository.url);
          if (gitHubUrl) {
            githubMetadata = await this.fetchGitHubMetadata(gitHubUrl);
          }
        } catch {
          console.log('Failed to fetch GitHub metadata from npm package');
        }
      }

      const capabilities = this.extractMCPCapabilities(versionData, githubMetadata.readme);
      const tags = this.extractTags(null, versionData, githubMetadata.readme);

      return {
        readme: githubMetadata.readme || data.readme,
        stars: githubMetadata.stars,
        downloads: downloadsData?.downloads,
        version: latestVersion,
        license: versionData.license,
        author: versionData.author?.name || versionData.author,
        lastUpdated: new Date(data.time?.[latestVersion]),
        logoUrl: githubMetadata.logoUrl,
        category: this.categorizePackage(versionData, githubMetadata.readme),
        tags,
        capabilities,
      };
    } catch (error) {
      console.error('Error fetching npm metadata:', error);
      throw new Error('Failed to fetch package metadata');
    }
  }

  /**
   * Normalize various Git URL formats to standard GitHub HTTPS URL
   */
  private normalizeGitHubUrl(gitUrl: string): string | null {
    const patterns = [
      /^git\+https:\/\/github\.com\/([^\/]+)\/([^\/]+)\.git$/,
      /^git:\/\/github\.com\/([^\/]+)\/([^\/]+)\.git$/,
      /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?$/,
      /^git@github\.com:([^\/]+)\/([^\/]+)\.git$/,
    ];

    for (const pattern of patterns) {
      const match = gitUrl.match(pattern);
      if (match) {
        return `https://github.com/${match[1]}/${match[2]}`;
      }
    }

    return null;
  }

  /**
   * Extract MCP capabilities from package.json and README
   */
  private extractMCPCapabilities(packageInfo: Record<string, unknown>, readme?: string): string[] {
    const capabilities: Set<string> = new Set();

    // Check package.json for MCP-specific fields
    const mcpInfo = packageInfo?.mcp as Record<string, unknown> | undefined;
    if (mcpInfo?.tools && typeof mcpInfo.tools === 'object') {
      Object.keys(mcpInfo.tools as Record<string, unknown>).forEach(tool => capabilities.add(tool));
    }

    // Parse README for capability mentions
    if (readme) {
      const mcpPatterns = [
        /## Tools?\s*\n([\s\S]*?)(?=\n## |\n# |\Z)/gi,
        /### Available Tools?\s*\n([\s\S]*?)(?=\n## |\n# |\Z)/gi,
        /\* `([^`]+)`[^\n]*tool/gi,
        /- `([^`]+)`[^\n]*tool/gi,
      ];

      mcpPatterns.forEach(pattern => {
        const matches = readme.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            // Extract tool names from the matched section
            const toolMatches = match[1].matchAll(/`([^`]+)`/g);
            for (const toolMatch of toolMatches) {
              if (toolMatch[1]) {
                capabilities.add(toolMatch[1]);
              }
            }
          }
        }
      });
    }

    return Array.from(capabilities);
  }

  /**
   * Extract relevant tags from repository and package data
   */
  private extractTags(repo: Record<string, unknown> | null, packageInfo: Record<string, unknown>, readme?: string): string[] {
    const tags: Set<string> = new Set();

    // Add package.json keywords
    if (Array.isArray(packageInfo?.keywords)) {
      packageInfo.keywords.forEach(keyword => {
        if (typeof keyword === 'string') {
          tags.add(keyword);
        }
      });
    }

    // Add GitHub topics
    if (Array.isArray(repo?.topics)) {
      repo.topics.forEach(topic => {
        if (typeof topic === 'string') {
          tags.add(topic);
        }
      });
    }

    // Extract common MCP-related terms from README
    if (readme) {
      const mcpKeywords = ['mcp', 'tool', 'server', 'client', 'ai', 'assistant', 'claude'];
      mcpKeywords.forEach(keyword => {
        if (readme.toLowerCase().includes(keyword)) {
          tags.add(keyword);
        }
      });
    }

    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }

  /**
   * Extract logo URL from package.json or README
   */
  private extractLogoUrl(packageInfo: Record<string, unknown>, readme?: string): string | undefined {
    // Check package.json for logo
    if (typeof packageInfo?.logo === 'string') return packageInfo.logo;

    // Parse README for image that might be a logo
    if (readme) {
      const logoPatterns = [/!\[logo\]\(([^)]+)\)/i, /!\[icon\]\(([^)]+)\)/i, /<img[^>]*src="([^"]*)"[^>]*>/i];

      for (const pattern of logoPatterns) {
        const match = readme.match(pattern);
        if (match) return match[1];
      }
    }

    return undefined;
  }

  /**
   * Categorize repository based on content and metadata
   */
  private categorizeRepository(repo: Record<string, unknown> | null, packageInfo: Record<string, unknown>, readme?: string): string {
    const content = `${repo?.description || ''} ${packageInfo?.description || ''} ${readme || ''}`.toLowerCase();

    const categories = {
      development: ['development', 'dev', 'coding', 'programming', 'build', 'deploy'],
      ai: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'claude'],
      productivity: ['productivity', 'workflow', 'automation', 'task'],
      data: ['data', 'database', 'analytics', 'visualization'],
      communication: ['chat', 'message', 'communication', 'slack', 'discord'],
      utility: ['utility', 'tool', 'helper', 'service'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return category;
      }
    }

    return 'utility';
  }

  /**
   * Categorize npm package
   */
  private categorizePackage(packageInfo: Record<string, unknown>, readme?: string): string {
    return this.categorizeRepository(null, packageInfo, readme);
  }
}

// Export a singleton instance
export const readmeFetcher = new ReadmeFetcher();
