class AuthService {
  async login({ email, password }) {
    // validate credential, issue JWT
    return { accessToken: 'jwt-token', user: { email } };
  }

  async register({ email, password, name }) {
    // create user, hash password
    return { id: 1, email, name };
  }
}

module.exports = new AuthService();
