const supabase = require('../config/supabase');
const { parseRule } = require('./campaignRuleParser');

const safeCount = async (tableName, filterColumn, value) => {
  try {
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq(filterColumn, value);
    return count || 0;
  } catch (error) {
    return 0;
  }
};

const logBehaviorEvent = async ({ userId, eventType, source = null, eventData = {} }) => {
  await supabase.from('user_behavior_events').insert([
    {
      user_id: userId || null,
      event_type: eventType,
      source,
      event_data: eventData || {},
      created_at: new Date().toISOString(),
    },
  ]);
};

const logCampaignEvents = async ({ userId, campaignIds = [], eventType, triggerSource = null, metadata = {} }) => {
  if (!userId || !Array.isArray(campaignIds) || !campaignIds.length) return;

  const rows = campaignIds.map((campaignId) => ({
    user_id: userId,
    campaign_id: campaignId,
    event_type: eventType,
    trigger_source: triggerSource,
    metadata,
    created_at: new Date().toISOString(),
  }));

  await supabase.from('user_campaign_logs').insert(rows);
};

const buildUserSegments = ({ purchasesCount, sessionsCount, hasPurchased }) => {
  const segments = [];

  if (!hasPurchased) segments.push('new_user');
  if (hasPurchased) segments.push('paying_user');
  if (purchasesCount >= 3) segments.push('high_value');
  if (sessionsCount >= 3) segments.push('active_learner');
  if (sessionsCount === 0) segments.push('inactive');

  return segments;
};

const buildEvaluationContext = async (userId) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, email, role, created_at')
    .eq('id', userId)
    .maybeSingle();

  const purchasesCount = await safeCount('purchases', 'user_id', userId);
  const sessionsCount = await safeCount('tryout_sessions', 'user_id', userId);
  const impressions7d = 0;
  const clicks7d = 0;

  const hasPurchased = purchasesCount > 0;
  const segments = buildUserSegments({ purchasesCount, sessionsCount, hasPurchased });

  return {
    user: user || { id: userId },
    metrics: {
      purchasesCount,
      sessionsCount,
      impressions7d,
      clicks7d,
      hasPurchased,
    },
    segments,
  };
};

const getActiveCampaigns = async () => {
  const now = new Date();
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, name, title, description, cta_text, target_url, rules, priority, status, start_at, end_at, updated_at')
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).filter((campaign) => {
    const startAt = campaign.start_at ? new Date(campaign.start_at) : null;
    const endAt = campaign.end_at ? new Date(campaign.end_at) : null;
    if (startAt && now < startAt) return false;
    if (endAt && now > endAt) return false;
    return true;
  });
};

const attachAssets = async (campaigns = []) => {
  if (!campaigns.length) return campaigns;

  const ids = campaigns.map((campaign) => campaign.id);
  const { data: assets } = await supabase
    .from('campaign_assets')
    .select('id, campaign_id, asset_url, asset_type, created_at')
    .in('campaign_id', ids)
    .order('created_at', { ascending: false });

  const assetMap = new Map();
  (assets || []).forEach((asset) => {
    if (!assetMap.has(asset.campaign_id)) {
      assetMap.set(asset.campaign_id, asset);
    }
  });

  return campaigns.map((campaign) => ({
    ...campaign,
    bannerUrl: assetMap.get(campaign.id)?.asset_url || null,
  }));
};

const evaluateCampaignsForUser = async ({ userId, triggerSource = 'dashboard' }) => {
  const context = await buildEvaluationContext(userId);
  const activeCampaigns = await getActiveCampaigns();

  const matched = activeCampaigns.filter((campaign) => parseRule(context, campaign.rules));
  const withAssets = await attachAssets(matched);

  await logBehaviorEvent({
    userId,
    eventType: 'campaign_evaluated',
    source: triggerSource,
    eventData: {
      matchedCount: withAssets.length,
      campaignIds: withAssets.map((campaign) => campaign.id),
      segments: context.segments,
    },
  });

  return {
    context,
    campaigns: withAssets,
  };
};

module.exports = {
  evaluateCampaignsForUser,
  logCampaignEvents,
  logBehaviorEvent,
};
