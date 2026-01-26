/**
 * Google OAuth Service
 * Handles Google authentication flow for MAY
 */

import crypto from 'crypto';

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Configuration from environment
const getConfig = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
});

/**
 * Check if Google OAuth is configured
 */
export function isGoogleAuthConfigured() {
  const config = getConfig();
  return !!(config.clientId && config.clientSecret);
}

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state) {
  const config = getConfig();
  
  if (!isGoogleAuthConfigured()) {
    throw new Error('Google OAuth not configured');
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code) {
  const config = getConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('[Google Auth] Token exchange failed:', error);
    throw new Error(error.error_description || 'Failed to exchange code for tokens');
  }

  const tokens = await response.json();
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    expiresIn: tokens.expires_in,
  };
}

/**
 * Get user info from Google using access token
 */
export async function getGoogleUserInfo(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('[Google Auth] Failed to get user info:', error);
    throw new Error('Failed to get user info from Google');
  }

  const userInfo = await response.json();
  return {
    id: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    emailVerified: userInfo.verified_email,
  };
}

/**
 * Verify Google ID token (alternative to userinfo endpoint)
 */
export async function verifyGoogleIdToken(idToken) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );

  if (!response.ok) {
    throw new Error('Invalid ID token');
  }

  const payload = await response.json();
  const config = getConfig();

  // Verify the token is for our app
  if (payload.aud !== config.clientId) {
    throw new Error('Token was not issued for this application');
  }

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    emailVerified: payload.email_verified === 'true',
  };
}

export default {
  isGoogleAuthConfigured,
  generateState,
  getGoogleAuthUrl,
  getTokensFromCode,
  getGoogleUserInfo,
  verifyGoogleIdToken,
};
