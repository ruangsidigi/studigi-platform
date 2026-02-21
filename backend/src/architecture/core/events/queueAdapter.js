const net = require('node:net');

class InMemoryQueueAdapter {
  async enqueue(jobName, payload, handler) {
    setImmediate(async () => {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`[Queue:${jobName}]`, error.message);
      }
    });
  }
}

class BullQueueAdapter {
  constructor({ queueName, redisUrl, Queue, Worker, IORedis }) {
    this.queueName = queueName;
    this.redisUrl = redisUrl;
    this.Queue = Queue;
    this.Worker = Worker;
    this.IORedis = IORedis;
    this.handlers = new Map();
    this.queue = null;
    this.worker = null;
    this.connection = null;
    this.initPromise = null;
    this.disabled = false;
  }

  async isRedisReachable() {
    try {
      const url = new URL(this.redisUrl);
      const host = url.hostname || '127.0.0.1';
      const port = Number(url.port || 6379);

      return await new Promise((resolve) => {
        const socket = net.createConnection({ host, port });
        const finish = (result) => {
          socket.removeAllListeners();
          socket.destroy();
          resolve(result);
        };

        socket.setTimeout(800);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
      });
    } catch {
      return false;
    }
  }

  async initialize() {
    if (this.disabled) return false;
    if (this.queue && this.worker) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const reachable = await this.isRedisReachable();
        if (!reachable) {
          console.warn(`[Queue:${this.queueName}] Redis endpoint not reachable. Fallback to in-memory execution.`);
          this.disabled = true;
          return false;
        }

        this.connection = new this.IORedis(this.redisUrl, {
          lazyConnect: true,
          enableOfflineQueue: false,
          retryStrategy: () => null,
          maxRetriesPerRequest: 1,
        });

        await this.connection.connect();

        this.queue = new this.Queue(this.queueName, {
          connection: this.connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        });

        this.worker = new this.Worker(
          this.queueName,
          async (job) => {
            const handler = this.handlers.get(String(job.id));
            if (!handler) {
              return;
            }

            try {
              await handler(job.data.payload);
            } finally {
              this.handlers.delete(String(job.id));
            }
          },
          { connection: this.connection }
        );

        this.worker.on('failed', (job, error) => {
          console.error(`[Queue:${this.queueName}] Job failed (${job?.name}):`, error?.message);
        });

        return true;
      } catch (error) {
        console.warn(`[Queue:${this.queueName}] Redis unavailable (${error.message}). Fallback to in-memory execution.`);
        this.disabled = true;
        return false;
      }
    })();

    return this.initPromise;
  }

  async runInMemory(jobName, payload, handler) {
    setImmediate(async () => {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`[Queue:${jobName}]`, error.message);
      }
    });
  }

  async enqueue(jobName, payload, handler) {
    const ready = await this.initialize();
    if (!ready || !this.queue) {
      await this.runInMemory(jobName, payload, handler);
      return;
    }

    try {
      const job = await this.queue.add(jobName, { payload, timestamp: Date.now() });
      this.handlers.set(String(job.id), handler);
    } catch (error) {
      console.warn(`[Queue:${this.queueName}] enqueue failed (${error.message}). Fallback to in-memory execution.`);
      this.disabled = true;
      await this.runInMemory(jobName, payload, handler);
    }
  }
}

const createQueueAdapter = () => {
  const isBullEnabled = String(process.env.BULLMQ_ENABLED || 'false').toLowerCase() === 'true';
  if (!isBullEnabled) {
    return new InMemoryQueueAdapter();
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('BULLMQ_ENABLED=true but REDIS_URL is missing. Falling back to InMemoryQueueAdapter.');
    return new InMemoryQueueAdapter();
  }

  try {
    const { Queue, Worker } = require('bullmq');
    const IORedis = require('ioredis');
    const queueName = process.env.BULLMQ_QUEUE_NAME || 'retention-events';
    console.log(`Queue adapter: BullMQ (${queueName})`);
    return new BullQueueAdapter({ queueName, redisUrl, Queue, Worker, IORedis });
  } catch (error) {
    console.warn(`BullMQ dependencies unavailable (${error.message}). Falling back to InMemoryQueueAdapter.`);
    return new InMemoryQueueAdapter();
  }
};

module.exports = createQueueAdapter();
