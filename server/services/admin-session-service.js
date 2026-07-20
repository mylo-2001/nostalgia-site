"use strict";

const crypto = require("node:crypto");
const { sha256 } = require("./inventory-service");

class AdminSessionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AdminSessionError";
    this.code = code;
  }
}

function secureEqualHash(value, expectedHash) {
  const actual = Buffer.from(sha256(String(value || "")), "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function createAdminDatabaseSession(options) {
  const client = await options.pool.connect();
  try {
    await client.query("BEGIN");
    let user = await client.query("SELECT id FROM admin_users WHERE lower(username)=lower($1) FOR UPDATE",
      [options.username]);
    if (!user.rowCount) {
      await client.query(`INSERT INTO admin_users
        (username,display_name,totp_enabled,requires_2fa,status)
        VALUES ($1,$1,$2,TRUE,'active') ON CONFLICT DO NOTHING`,
      [options.username, !!options.mfaVerified]);
      user = await client.query("SELECT id FROM admin_users WHERE lower(username)=lower($1) FOR UPDATE",
        [options.username]);
    }
    if (!user.rowCount) throw new AdminSessionError("ADMIN_SYNC_FAILED", "Administrator could not be synchronized");
    const previousLogin = await client.query(`SELECT EXISTS(SELECT 1 FROM admin_login_events
      WHERE admin_user_id=$1 AND outcome='success') AS any_login,
      EXISTS(SELECT 1 FROM admin_login_events WHERE admin_user_id=$1 AND outcome='success'
        AND ip_address IS NOT DISTINCT FROM $2::inet) AS known_ip`,
    [user.rows[0].id, options.ipAddress || null]);
    await client.query(`UPDATE admin_users SET totp_enabled=$2,last_login_at=now(),updated_at=now()
      WHERE id=$1`, [user.rows[0].id, !!options.mfaVerified]);
    await client.query(`INSERT INTO admin_user_roles (admin_user_id,role_code)
      VALUES ($1,'administrator') ON CONFLICT DO NOTHING`, [user.rows[0].id]);
    await client.query(`INSERT INTO admin_sessions (admin_user_id,token_hash,csrf_secret_hash,
      ip_address,user_agent,expires_at,last_seen_at,mfa_verified,session_family_id)
      VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8)`, [user.rows[0].id,
      sha256(options.sessionId), options.csrfHash, options.ipAddress || null,
      options.userAgent || null, new Date(options.expiresAt), !!options.mfaVerified,
      options.sessionFamilyId]);
    await client.query(`INSERT INTO admin_login_events (admin_user_id,username_hash,outcome,
      ip_address,user_agent,request_id) VALUES ($1,$2,'success',$3,$4,$5)`,
    [user.rows[0].id, sha256(`admin-login:${options.username.toLowerCase()}`),
      options.ipAddress || null, options.userAgent || null, options.requestId || null]);
    if (previousLogin.rows[0].any_login && !previousLogin.rows[0].known_ip) {
      await client.query(`INSERT INTO admin_security_alerts
        (admin_user_id,alert_type,severity,details) VALUES ($1,'new_ip_login','medium',$2)
        ON CONFLICT(admin_user_id,alert_type) WHERE status='open' AND admin_user_id IS NOT NULL
        DO UPDATE SET details=EXCLUDED.details,created_at=now()`,
      [user.rows[0].id, { ipAddress: options.ipAddress || null,
        requestId: options.requestId || null }]);
    }
    await client.query("COMMIT");
    return { adminUserId: user.rows[0].id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function recordAdminLoginEvent(options) {
  const outcome = String(options.outcome || "");
  if (!["invalid_credentials", "invalid_mfa", "blocked", "mfa_required"].includes(outcome)) {
    throw new AdminSessionError("ADMIN_LOGIN_OUTCOME_INVALID", "Admin login outcome is invalid");
  }
  const username = String(options.username || "").toLowerCase().trim();
  const client = await options.pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query("SELECT id FROM admin_users WHERE lower(username)=lower($1)",
      [username]);
    const adminUserId = user.rows[0]?.id || null;
    const usernameHash = sha256(`admin-login:${username}`);
    await client.query(`INSERT INTO admin_login_events (admin_user_id,username_hash,outcome,
      ip_address,user_agent,request_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [adminUserId, usernameHash, outcome, options.ipAddress || null,
      options.userAgent || null, options.requestId || null]);
    if (adminUserId && ["invalid_credentials", "invalid_mfa", "blocked"].includes(outcome)) {
      const recent = await client.query(`SELECT COUNT(*)::int AS failures FROM admin_login_events
        WHERE admin_user_id=$1 AND outcome IN ('invalid_credentials','invalid_mfa','blocked')
          AND created_at>=now()-interval '15 minutes'`, [adminUserId]);
      if (recent.rows[0].failures >= 5) {
        await client.query(`INSERT INTO admin_security_alerts
          (admin_user_id,alert_type,severity,details)
          VALUES ($1,'repeated_login_failures','high',$2)
          ON CONFLICT(admin_user_id,alert_type) WHERE status='open' AND admin_user_id IS NOT NULL
          DO UPDATE SET details=EXCLUDED.details,created_at=now()`,
        [adminUserId, { attempts: recent.rows[0].failures,
          windowMinutes: 15, requestId: options.requestId || null }]);
      }
    }
    await client.query("COMMIT");
    return { recorded: true, adminUserId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function validateAdminDatabaseSession(options) {
  if (!options.session?.sid) throw new AdminSessionError("ADMIN_SESSION_INVALID", "Admin session is invalid");
  const client = await options.pool.connect();
  try {
    const result = await client.query(`SELECT s.id session_id,s.admin_user_id,s.csrf_secret_hash,
      s.mfa_verified,s.expires_at,u.status,u.requires_2fa,u.totp_enabled
      FROM admin_sessions s JOIN admin_users u ON u.id=s.admin_user_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()`,
    [sha256(options.session.sid)]);
    if (!result.rowCount || result.rows[0].status !== "active") {
      throw new AdminSessionError("ADMIN_SESSION_INVALID", "Admin session is expired or revoked");
    }
    const row = result.rows[0];
    const requireMfa = options.requireMfa !== false && row.requires_2fa;
    if (requireMfa && (!row.totp_enabled || !row.mfa_verified || !options.session.mfa)) {
      throw new AdminSessionError("ADMIN_2FA_REQUIRED", "Administrator must complete 2FA");
    }
    await client.query("UPDATE admin_sessions SET last_seen_at=now() WHERE id=$1", [row.session_id]);
    return { adminUserId: row.admin_user_id, csrfHash: row.csrf_secret_hash,
      sessionId: row.session_id };
  } finally { client.release(); }
}

async function revokeAdminSessions(options) {
  const client = await options.pool.connect();
  try {
    const result = await client.query(`UPDATE admin_sessions SET revoked_at=now(),revoke_reason=$2
      WHERE admin_user_id=$1 AND revoked_at IS NULL`,
    [options.adminUserId, options.reason || "logout_all"]);
    await client.query(`INSERT INTO audit_logs (actor_type,actor_id,action,entity_type,entity_id,
      new_values,source,request_id) VALUES ('admin',$1,'admin.sessions_revoked','admin_user',$1,$2,
      'admin.security',$3)`, [options.adminUserId, { count: result.rowCount }, options.requestId || null]);
    return { revoked: result.rowCount };
  } finally { client.release(); }
}

async function revokeAdminSession(options) {
  if (!options.sessionId) return { revoked: 0 };
  const client = await options.pool.connect();
  try {
    const result = await client.query(`UPDATE admin_sessions
      SET revoked_at=now(),revoke_reason=$2 WHERE token_hash=$1 AND revoked_at IS NULL`,
    [sha256(options.sessionId), options.reason || "logout"]);
    return { revoked: result.rowCount };
  } finally { client.release(); }
}

async function consumeDatabaseRateLimit(options) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const keyHash = sha256(`rate:${options.scope}:${options.key}`);
  const client = await options.pool.connect();
  try {
    const result = await client.query(`INSERT INTO security_rate_limits
      (scope,key_hash,window_start,window_ms,hit_count,expires_at)
      VALUES ($1,$2,$3,$4,1,$5)
      ON CONFLICT(scope,key_hash) DO UPDATE SET
        window_start=CASE WHEN security_rate_limits.expires_at<=$3 THEN $3 ELSE security_rate_limits.window_start END,
        hit_count=CASE WHEN security_rate_limits.expires_at<=$3 THEN 1 ELSE security_rate_limits.hit_count+1 END,
        window_ms=$4,
        expires_at=CASE WHEN security_rate_limits.expires_at<=$3 THEN $5 ELSE security_rate_limits.expires_at END
      RETURNING hit_count,expires_at`, [options.scope, keyHash, now, options.windowMs,
      new Date(now.getTime() + options.windowMs)]);
    return { allowed: result.rows[0].hit_count <= options.limit,
      remaining: Math.max(0, options.limit - result.rows[0].hit_count),
      retryAfterSeconds: Math.max(1, Math.ceil((new Date(result.rows[0].expires_at)-now)/1000)) };
  } finally { client.release(); }
}

module.exports = { AdminSessionError, consumeDatabaseRateLimit,
  createAdminDatabaseSession, revokeAdminSession, revokeAdminSessions, secureEqualHash,
  recordAdminLoginEvent, validateAdminDatabaseSession };
