const supabase = require('../../../config/supabase');

const appendEventLog = async ({ eventType, aggregateId, payload, status = 'processed', errorMessage = null }) => {
  const { error } = await supabase.from('event_log').insert([
    {
      event_type: eventType,
      aggregate_id: aggregateId,
      payload,
      status,
      error_message: errorMessage,
      created_at: new Date(),
    },
  ]);

  if (error) {
    const message = String(error.message || '');
    if (message.includes("Could not find the table 'public.event_log'")) {
      return;
    }
    throw new Error(message);
  }
};

const listEventLogs = async ({ limit = 20, status, eventType } = {}) => {
  let query = supabase
    .from('event_log')
    .select('id, event_type, aggregate_id, status, error_message, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(200, Number(limit) || 20)));

  if (status) {
    query = query.eq('status', String(status));
  }

  if (eventType) {
    query = query.eq('event_type', String(eventType));
  }

  const { data, error } = await query;
  if (error) {
    const message = String(error.message || '');
    if (message.includes("Could not find the table 'public.event_log'")) {
      return [];
    }
    throw new Error(message);
  }

  return data || [];
};

const summarizeEventLogs = async ({ limit = 200 } = {}) => {
  const { data, error } = await supabase
    .from('event_log')
    .select('event_type, status, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(1000, Number(limit) || 200)));

  if (error) {
    const message = String(error.message || '');
    if (message.includes("Could not find the table 'public.event_log'")) {
      return {
        total: 0,
        processed: 0,
        failed: 0,
        byEventType: {},
        latestFailure: null,
      };
    }
    throw new Error(message);
  }

  const rows = data || [];
  const byEventType = {};
  let latestFailure = null;

  for (const row of rows) {
    const eventType = String(row.event_type || 'UNKNOWN');
    if (!byEventType[eventType]) {
      byEventType[eventType] = { processed: 0, failed: 0, total: 0 };
    }

    const normalizedStatus = String(row.status || 'processed').toLowerCase();
    byEventType[eventType].total += 1;
    if (normalizedStatus === 'failed') {
      byEventType[eventType].failed += 1;
      if (!latestFailure) {
        latestFailure = {
          eventType,
          errorMessage: row.error_message || null,
          createdAt: row.created_at || null,
        };
      }
    } else {
      byEventType[eventType].processed += 1;
    }
  }

  const processed = rows.filter((row) => String(row.status || 'processed').toLowerCase() !== 'failed').length;
  const failed = rows.length - processed;

  return {
    total: rows.length,
    processed,
    failed,
    byEventType,
    latestFailure,
  };
};

module.exports = {
  appendEventLog,
  listEventLogs,
  summarizeEventLogs,
};
