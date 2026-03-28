// backend/services/campaigns/engine.js
// Lightweight campaign evaluation engine.
class CampaignEngine {
  static evaluate(campaign, user, context = {}) {
    if (!campaign || !campaign.active) return false;
    const t = campaign.targeting || {};
    const now = new Date();
    if (t.date_from && new Date(t.date_from) > now) return false;
    if (t.date_to && new Date(t.date_to) < now) return false;
    if (t.roles && t.roles.length) {
      const userRoles = (user.roles || []).map(r => r.name);
      if (!t.roles.some(r => userRoles.includes(r))) return false;
    }
    if (t.custom && Array.isArray(t.custom)) {
      for (const rule of t.custom) {
        const val = (context[rule.attr] ?? user[rule.attr]);
        if (rule.op === '>=' && !(val >= rule.value)) return false;
        if (rule.op === '<=' && !(val <= rule.value)) return false;
        if (rule.op === '==' && !(val == rule.value)) return false;
      }
    }
    return true;
  }
}

module.exports = CampaignEngine;
