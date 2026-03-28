const getByPath = (obj, path) => {
  if (!path) return undefined;
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
};

const evaluateCondition = (context, condition = {}) => {
  const field = condition.field;
  const operator = condition.op || 'eq';
  const expected = condition.value;
  const actual = getByPath(context, field);

  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual);
    case 'contains':
      return typeof actual === 'string' && String(actual).toLowerCase().includes(String(expected || '').toLowerCase());
    case 'includes':
      return Array.isArray(actual) && actual.includes(expected);
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'between':
      return Array.isArray(expected) && expected.length === 2
        ? Number(actual) >= Number(expected[0]) && Number(actual) <= Number(expected[1])
        : false;
    default:
      return false;
  }
};

const parseRule = (context, rules) => {
  if (!rules || typeof rules !== 'object') return true;

  if (Array.isArray(rules.all) && rules.all.length) {
    return rules.all.every((condition) => evaluateCondition(context, condition));
  }

  if (Array.isArray(rules.any) && rules.any.length) {
    return rules.any.some((condition) => evaluateCondition(context, condition));
  }

  if (rules.condition) {
    return evaluateCondition(context, rules.condition);
  }

  return true;
};

module.exports = {
  parseRule,
};
