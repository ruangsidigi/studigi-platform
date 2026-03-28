const { registerScoreUpdatedWorker } = require('./scoreUpdatedWorker');
const { registerGamificationWorker } = require('./gamificationWorker');
const { registerAiEdtechWorker } = require('./aiEdtechWorker');
const { registerPlatformEventWorker } = require('./platformEventWorker');

const registerAllWorkers = () => {
  registerScoreUpdatedWorker();
  registerGamificationWorker();
  registerAiEdtechWorker();
  registerPlatformEventWorker();
};

module.exports = { registerAllWorkers };
