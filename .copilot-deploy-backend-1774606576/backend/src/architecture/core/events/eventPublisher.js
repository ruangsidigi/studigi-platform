const EventEmitter = require('events');
const { appendEventLog } = require('./eventLogRepository');
const queueAdapter = require('./queueAdapter');

class EventPublisher {
  constructor() {
    this.bus = new EventEmitter();
  }

  subscribe(eventType, handler) {
    this.bus.on(eventType, async (event) => {
      try {
        await handler(event);
        try {
          await appendEventLog({
            eventType,
            aggregateId: event.aggregateId,
            payload: event,
            status: 'processed',
          });
        } catch (logError) {
          console.error('Event log warning:', logError.message);
        }
      } catch (error) {
        try {
          await appendEventLog({
            eventType,
            aggregateId: event.aggregateId,
            payload: event,
            status: 'failed',
            errorMessage: error.message,
          });
        } catch (logError) {
          console.error('Event log warning:', logError.message);
        }
      }
    });
  }

  async publish(eventType, payload) {
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventType,
      aggregateId: payload.attemptId || payload.userId || null,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    await queueAdapter.enqueue(eventType, event, async (queuedEvent) => {
      this.bus.emit(eventType, queuedEvent);
    });

    return event;
  }
}

module.exports = new EventPublisher();
