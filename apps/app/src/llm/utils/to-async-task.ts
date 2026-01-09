import { v4 as uuidv4 } from 'uuid';

interface ToAsyncTask<Result = any> {
  id: string;
  created: Date;
  status: 'pending' | 'succeeded' | 'failed';
  result: Result | null;
  promise: Promise<Result>;
  error: string | null;
}

/**
 * 将一个 Promise 转换为异步任务
 *
 * @param promise
 * @returns
 */
export class ToAsyncTaskManager<Result = any> {
  private tasks: Record<string, ToAsyncTask<Result>> = {};

  addTask(p: Promise<Result> | (() => Promise<Result>)): ToAsyncTask<Result> {
    const promise = typeof p === 'function' ? p() : p;
    const task: ToAsyncTask<Result> = {
      id: uuidv4(),
      created: new Date(),
      status: 'pending',
      result: null,
      promise,
      error: null,
    };
    this.tasks[task.id] = task;
    promise
      .then((result: any) => {
        if (result.error) {
          task.status = 'failed';
          task.error = result.error.message;
          return;
        }
        task.status = 'succeeded';
        task.result = result;
      })
      .catch(error => {
        console.error('addTask error', error);
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : String(error);
      });
    return task;
  }

  getTask(id: string): ToAsyncTask<Result> | null {
    return this.tasks[id] || null;
  }

  removeTask(id: string) {
    delete this.tasks[id];
  }
}
