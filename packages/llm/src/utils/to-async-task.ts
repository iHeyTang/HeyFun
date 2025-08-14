import { v4 as uuidv4 } from 'uuid';

interface ToAsyncTask<Result = any> {
  id: string;
  created: Date;
  status: 'pending' | 'succeeded' | 'failed';
  result: Result | null;
  promise: Promise<Result>;
}

/**
 * 将一个 Promise 转换为异步任务
 *
 * @param promise
 * @returns
 */
export class ToAsyncTaskManager<Result = any> {
  private tasks: Record<string, ToAsyncTask<Result>> = {};

  addTask(promise: Promise<Result>): ToAsyncTask<Result> {
    const task: ToAsyncTask<Result> = {
      id: uuidv4(),
      created: new Date(),
      status: 'pending',
      result: null,
      promise,
    };
    this.tasks[task.id] = task;
    new Promise<void>(resolve => {
      promise
        .then(result => {
          task.status = 'succeeded';
          task.result = result;
          resolve();
        })
        .catch(error => {
          task.status = 'failed';
          task.result = error;
          resolve();
        });
    });
    return task;
  }

  getTask(id: string): ToAsyncTask | null {
    return this.tasks[id] || null;
  }

  removeTask(id: string) {
    delete this.tasks[id];
  }
}
