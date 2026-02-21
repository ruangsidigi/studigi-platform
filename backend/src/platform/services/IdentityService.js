class IdentityService {
  async resolveActorContext({ user }) {
    return {
      userId: user?.id,
      role: user?.role || 'user',
      tenantId: 'default',
    };
  }
}

module.exports = new IdentityService();
