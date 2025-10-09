const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db/connection');

function setupGoogleOAuth() {
  const callbackURL = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
  
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      await db.connect();
      
      // Check if user exists with this Google ID
      let users = await db.query(
        'SELECT * FROM users WHERE google_id = ?',
        [profile.id]
      );
      
      let user;
      
      if (users.length > 0) {
        // User exists, update tokens
        user = users[0];
        
        await db.query(`
          UPDATE users 
          SET oauth_access_token = ?,
              oauth_refresh_token = ?,
              last_login_at = NOW(),
              updated_at = NOW()
          WHERE id = ?
        `, [accessToken, refreshToken || null, user.id]);
        
      } else {
        // Check if user exists with this email
        users = await db.query(
          'SELECT * FROM users WHERE email = ?',
          [profile.emails[0].value]
        );
        
        if (users.length > 0) {
          // Link Google account to existing user
          user = users[0];
          
          await db.query(`
            UPDATE users 
            SET google_id = ?,
                oauth_provider = 'google',
                oauth_access_token = ?,
                oauth_refresh_token = ?,
                email_verified = TRUE,
                verified_at = NOW(),
                avatar_url = ?,
                last_login_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
          `, [
            profile.id,
            accessToken,
            refreshToken || null,
            profile.photos?.[0]?.value || null,
            user.id
          ]);
          
        } else {
          // Create new user
          const email = profile.emails?.[0]?.value;
          const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
          const lastNameRaw = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
          const lastName = lastNameRaw.trim() || null;
          const avatarUrl = profile.photos?.[0]?.value || null;
          
          // Generate username from email
          const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          
          const result = await db.query(`
            INSERT INTO users (
              username,
              email,
              google_id,
              oauth_provider,
              oauth_access_token,
              oauth_refresh_token,
              first_name,
              last_name,
              avatar_url,
              role,
              status,
              email_verified,
              verified_at,
              last_login_at,
              created_at
            ) VALUES (?, ?, ?, 'google', ?, ?, ?, ?, ?, 'individual', 'active', TRUE, NOW(), NOW(), NOW())
          `, [
            username,
            email,
            profile.id,
            accessToken,
            refreshToken || null,
            firstName,
            lastName,
            avatarUrl
          ]);
          
          // Get created user
          const newUsers = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [result.insertId]
          );
          
          user = newUsers[0];
        }
      }
      
      return done(null, user);
      
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, null);
    }
  }));
  
  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      await db.connect();
      const users = await db.query('SELECT * FROM users WHERE id = ?', [id]);
      done(null, users[0] || null);
    } catch (error) {
      done(error, null);
    }
  });
}

module.exports = setupGoogleOAuth;