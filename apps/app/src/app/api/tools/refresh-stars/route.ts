import { prisma } from '@/lib/server/prisma';
import { readmeFetcher } from '@/lib/server/readme-fetcher';
import { to } from '@/lib/shared/to';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Get all tools that have GitHub repository URLs
    const tools = await prisma.toolSchemas.findMany({
      where: { repoUrl: { contains: 'github.com' } },
      select: { id: true, name: true, repoUrl: true, stars: true },
    });

    if (tools.length === 0) {
      return NextResponse.json(
        {
          message: 'No tools with GitHub repositories found',
          updated: 0,
          errors: [],
        },
        { status: 200 },
      );
    }

    const results = {
      updated: 0,
      errors: [] as Array<{ toolId: string; toolName: string; error: string }>,
    };

    // Process tools in batches to avoid rate limiting
    const BATCH_SIZE = 5;
    for (let i = 0; i < tools.length; i += BATCH_SIZE) {
      const batch = tools.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async tool => {
          if (!tool.repoUrl) return;

          const [error, metadata] = await to(readmeFetcher.fetchGitHubMetadata(tool.repoUrl));

          if (error) {
            console.error(`Error updating stars for tool ${tool.name}:`, error);
            results.errors.push({
              toolId: tool.id,
              toolName: tool.name,
              error: error.message || 'Unknown error',
            });
            return;
          }

          if (metadata?.stars !== undefined) {
            try {
              await prisma.toolSchemas.update({
                where: { id: tool.id },
                data: {
                  stars: metadata.stars,
                  downloads: metadata.downloads,
                  license: metadata.license,
                  author: metadata.author,
                  category: metadata.category,
                  tags: metadata.tags,
                  capabilities: metadata.capabilities,
                  lastUpdated: new Date(),
                },
              });
              results.updated++;
            } catch (updateError) {
              console.error(`Database update error for tool ${tool.name}:`, updateError);
              results.errors.push({
                toolId: tool.id,
                toolName: tool.name,
                error: 'Failed to update database',
              });
            }
          }
        }),
      );

      // Add a small delay between batches to be respectful to GitHub API
      if (i + BATCH_SIZE < tools.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      message: `Successfully refreshed stars for ${results.updated} out of ${tools.length} tools`,
      updated: results.updated,
      total: tools.length,
      errors: results.errors,
    });
  } catch (error) {
    console.error('Error refreshing tool stars:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh tool stars',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
