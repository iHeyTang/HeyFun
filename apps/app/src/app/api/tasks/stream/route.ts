import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { NextRequest } from 'next/server';

export const GET = withUserAuthApi<{}, { taskId: string }, {}>(async (request: NextRequest, ctx) => {
  const { taskId } = ctx.query;
  const task = await prisma.tasks.findUnique({ where: { id: taskId, organizationId: ctx.orgId } });
  if (!task) throw new Error('Task not found');

  // Create SSE response
  const encoder = new TextEncoder();
  let pollInterval: NodeJS.Timeout;
  let isClosed = false;
  const stream = new ReadableStream({
    start(controller) {
      let lastProgressCreatedAt = new Date('1970-01-01');
      const sendProgress = async () => {
        if (isClosed) return;

        try {
          // Get current task status
          const currentTask = await prisma.tasks.findUnique({
            where: { id: taskId, organizationId: ctx.orgId },
          });

          if (!currentTask) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Task not found' })}\n\n`));
            controller.close();
            return;
          }

          // Get new progress data using createdAt optimization
          const newProgresses = await prisma.taskProgresses.findMany({
            where: {
              taskId,
              organizationId: ctx.orgId,
              createdAt: { gt: lastProgressCreatedAt },
            },
            orderBy: { createdAt: 'asc' },
          });

          // Send new progress data if any
          if (newProgresses.length > 0) {
            for (const progress of newProgresses) {
              if (isClosed) return;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', data: progress })}\n\n`));
              lastProgressCreatedAt = progress.createdAt;
            }
          }

          // Send task status update
          if (!isClosed) {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          }

          // Stop polling if task is completed or failed
          if (currentTask.status === 'completed' || currentTask.status === 'failed') {
            clearInterval(pollInterval);
            if (!isClosed) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'end', data: { status: currentTask.status } })}\n\n`));
              controller.close();
            }
            isClosed = true;
          }
        } catch (error) {
          console.error('Error fetching task progress:', error);
          if (!isClosed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Failed to fetch progress' })}\n\n`));
            clearInterval(pollInterval);
            controller.close();
          }
          isClosed = true;
        }
      };

      // Send initial progress data
      sendProgress();

      // Set up polling for non-completed tasks
      pollInterval = setInterval(sendProgress, 2000); // Poll every 2 seconds

      // Cleanup on close
      return () => {
        isClosed = true;
        if (pollInterval) {
          clearInterval(pollInterval);
        }
      };
    },
    cancel() {
      // Cleanup if client disconnects
      isClosed = true;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
});
