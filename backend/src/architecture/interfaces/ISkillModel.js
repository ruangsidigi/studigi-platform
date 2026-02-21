class ISkillModel {
  async updateSkill(_payload) {
    throw new Error('updateSkill() must be implemented');
  }

  async getSkillSnapshot(_userId) {
    throw new Error('getSkillSnapshot() must be implemented');
  }
}

module.exports = ISkillModel;
