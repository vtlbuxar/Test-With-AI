import { EventEmitter } from 'events';
import { AIConfig } from '../ensemble';


export type RunControlState = 'Running' | 'Paused' | 'Cancelled' | 'Pending' | 'Completed';

export interface ExecutionJob {
  runId: string;
  projectId: string;
  testCaseIds: string[];
  websiteUrl: string;
  browser: 'chromium' | 'firefox' | 'webkit' | 'edge';
  status: RunControlState;
  progressLogs: string[];
  currentStepIndex: number;
  totalSteps: number;
  createdAt: number;
  aiConfig?: AIConfig;
}

class QueueManager extends EventEmitter {
  private queue: ExecutionJob[] = [];
  private activeJob: ExecutionJob | null = null;
  private jobHistory: Record<string, ExecutionJob> = {};
  private isProcessing = false;

  constructor() {
    super();
    // Start processing queue loop
    this.startWorkerLoop();
  }

  public enqueue(
    runId: string,
    projectId: string,
    testCaseIds: string[],
    websiteUrl: string,
    browser: 'chromium' | 'firefox' | 'webkit' | 'edge',
    aiConfig?: AIConfig
  ): ExecutionJob {
    const job: ExecutionJob = {
      runId,
      projectId,
      testCaseIds,
      websiteUrl,
      browser,
      status: 'Pending',
      progressLogs: [`[System] Enqueued test run ${runId}`],
      currentStepIndex: 0,
      totalSteps: 0,
      createdAt: Date.now(),
      aiConfig,
    };

    this.queue.push(job);
    this.jobHistory[runId] = job;
    this.emit('queue_updated');
    this.addLog(runId, `[System] Job queued. Position in queue: ${this.queue.length}`);
    return job;
  }

  public getJob(runId: string): ExecutionJob | undefined {
    return this.jobHistory[runId];
  }

  public getActiveJob(): ExecutionJob | null {
    return this.activeJob;
  }

  public getQueue(): ExecutionJob[] {
    return this.queue;
  }

  public addLog(runId: string, message: string) {
    const job = this.jobHistory[runId];
    if (job) {
      const timestamp = new Date().toLocaleTimeString();
      job.progressLogs.push(`[${timestamp}] ${message}`);
      this.emit('progress', { runId, message });
    }
  }

  public updateJobProgress(runId: string, current: number, total: number) {
    const job = this.jobHistory[runId];
    if (job) {
      job.currentStepIndex = current;
      job.totalSteps = total;
      this.emit('progress', { runId });
    }
  }

  public updateJobStatus(runId: string, status: RunControlState) {
    const job = this.jobHistory[runId];
    if (job) {
      job.status = status;
      this.emit('status_changed', { runId, status });
    }
  }

  public pause(runId: string): boolean {
    const job = this.jobHistory[runId];
    if (job && job.status === 'Running') {
      job.status = 'Paused';
      this.addLog(runId, `[Control] Execution PAUSED by administrator.`);
      this.emit('control', { runId, action: 'PAUSE' });
      return true;
    }
    return false;
  }

  public resume(runId: string): boolean {
    const job = this.jobHistory[runId];
    if (job && job.status === 'Paused') {
      job.status = 'Running';
      this.addLog(runId, `[Control] Execution RESUMED by administrator.`);
      this.emit('control', { runId, action: 'RESUME' });
      return true;
    }
    return false;
  }

  public cancel(runId: string): boolean {
    const job = this.jobHistory[runId];
    if (job && (job.status === 'Running' || job.status === 'Paused' || job.status === 'Pending')) {
      job.status = 'Cancelled';
      this.addLog(runId, `[Control] Execution CANCELLED by administrator.`);
      // Remove from active queue if pending
      this.queue = this.queue.filter(j => j.runId !== runId);
      this.emit('control', { runId, action: 'CANCEL' });
      if (this.activeJob?.runId === runId) {
        this.activeJob = null;
      }
      return true;
    }
    return false;
  }

  private async startWorkerLoop() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (true) {
      if (this.queue.length > 0) {
        const nextJob = this.queue.shift();
        if (nextJob && nextJob.status === 'Pending') {
          this.activeJob = nextJob;
          this.updateJobStatus(nextJob.runId, 'Running');
          this.addLog(nextJob.runId, `[System] Worker picked up job. Starting execution...`);
          
          try {
            // Import executor dynamically to avoid circular references
            const { executePlaywrightPOM } = await import('./playwright-runner');
            await executePlaywrightPOM(nextJob);
          } catch (e: any) {
            this.addLog(nextJob.runId, `[Error] Critical worker failure: ${e.message || e}`);
            this.updateJobStatus(nextJob.runId, 'Completed');
          } finally {
            this.activeJob = null;
            this.emit('queue_updated');
          }
        }
      }
      // Wait 1 second before checking queue again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Global singleton declaration to preserve state across hot-reloads
const globalForQueue = global as unknown as { queueManager: QueueManager };
export const queueManager = globalForQueue.queueManager || new QueueManager();
if (process.env.NODE_ENV !== 'production') globalForQueue.queueManager = queueManager;
