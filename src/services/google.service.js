const { OAuth2Client } = require('google-auth-library');
const config = require('../config/config');
const { UnauthorizedError } = require('../utils/errors');

const client = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

const verifyAuthCode = async (authCode) => {
  try {
    const { tokens } = await client.getToken(authCode);
    
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.google.clientId
    });
    
    const payload = ticket.getPayload();
    
    return {
      id: payload.sub,         
      email: payload.email,
      emailVerified: payload.email_verified
    };
  } catch (error) {
    console.error('Google auth error:', error.message);
    throw new UnauthorizedError('Invalid Google authorization code');
  }
};

module.exports = { verifyAuthCode };
