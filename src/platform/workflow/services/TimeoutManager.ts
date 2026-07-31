import type { WorkflowTimeout } from "../contracts";

export class TimeoutManager {
  async runWithTimeout<TValue>(task: Promise<TValue>, timeout?: WorkflowTimeout): Promise<TValue> {
    if (!timeout) {
      return task;
    }

    return new Promise<TValue>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("workflow_step_timeout"));
      }, timeout.timeoutMs);

      task
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
