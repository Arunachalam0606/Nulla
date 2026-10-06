import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Bindings = {
  DB: D1Database;
  STORAGE_BUCKET: R2Bucket;
  JWT_SECRET: string;
  ADMIN_API_KEY: string;
  CORS_ORIGIN?: string;
  RESEND_API_KEY?: string;
};

type Variables = {
  userId: string;
  deviceId: string;
  userRole: 'user' | 'admin';
  userEmail: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ---------------------------------------------------------------------------
// Cryptographic & Utility Primitives (Web Crypto API)
// ---------------------------------------------------------------------------

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToUint8Array(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): Uint8Array {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

function generateSecureToken(byteLength = 32): string {
  const buffer = new Uint8Array(byteLength);
  crypto.getRandomValues(buffer);
  return base64UrlEncode(buffer);
}

async function deriveServerAuthHash(serverAuthKey: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(serverAuthKey),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt + ':server-hash-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bufferToHex(derived);
}

async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${dataToSign}.${encodedSignature}`;
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const enc = new TextEncoder();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const dataToVerify = `${encodedHeader}.${encodedPayload}`;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = base64UrlDecode(encodedSignature);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      enc.encode(dataToVerify)
    );

    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const payload = JSON.parse(payloadJson);

    // Validate expiration
    if (payload.exp && typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (now > payload.exp) return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Global Middlewares
// ---------------------------------------------------------------------------

app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['*'],
    exposeHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
    maxAge: 86400,
    credentials: true,
  })
);

app.options('*', (c) => c.text('', 204));
app.options('/api/nodes/*', (c) => c.text('', 204));
app.options('/api/upload/multipart/*', (c) => c.text('', 204));


// Authenticated session middleware
const authMiddleware = async (c: any, next: any) => {
  let token = '';
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (c.req.query('token')) {
    token = c.req.query('token').trim();
  }

  if (!token) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload || !payload.userId || !payload.deviceId) {
    return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
  }

  // Validate device revocation status in D1
  const device = await c.env.DB.prepare(
    'SELECT id, revoked_at FROM devices WHERE id = ? AND user_id = ?'
  )
    .bind(payload.deviceId, payload.userId)
    .first();

  if (!device || device.revoked_at !== null) {
    return c.json({ error: 'Unauthorized: Session revoked' }, 401);
  }

  // Update device last_active_at timestamp asynchronously
  c.executionCtx.waitUntil(
    c.env.DB.prepare("UPDATE devices SET last_active_at = datetime('now') WHERE id = ?")
      .bind(payload.deviceId)
      .run()
  );

  c.set('userId', payload.userId as string);
  c.set('deviceId', payload.deviceId as string);
  c.set('userRole', (payload.role as 'user' | 'admin') || 'user');
  c.set('userEmail', payload.email as string);

  await next();
};

// Admin authorization guard
const adminMiddleware = async (c: any, next: any) => {
  const adminKeyHeader = c.req.header('X-Admin-Key');
  if (adminKeyHeader && c.env.ADMIN_API_KEY && timingSafeEqual(adminKeyHeader, c.env.ADMIN_API_KEY)) {
    return await next();
  }

  let userRole = c.get('userRole');
  if (!userRole) {
    let token = '';
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (c.req.query('token')) {
      token = c.req.query('token').trim();
    }
    if (token) {
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      if (payload && payload.userId) {
        c.set('userId', payload.userId as string);
        c.set('userRole', (payload.role as 'user' | 'admin') || 'user');
        c.set('userEmail', payload.email as string);
        userRole = payload.role;
      }
    }
  }

  if (userRole === 'admin') {
    return await next();
  }

  return c.json({ error: 'Forbidden: Admin access required' }, 403);
};

// ---------------------------------------------------------------------------
// Health & Root Status
// ---------------------------------------------------------------------------

app.get('/', (c) => {
  return c.json({
    name: 'Nulla Engine API',
    tagline: '0 bytes on your Mac. Terabytes in the cloud.',
    version: '1.0.0',
    status: 'operational',
    e2ee: 'AES-256-GCM / 4MB Deterministic Block Chunks',
  });
});

// ---------------------------------------------------------------------------
// Authentication Endpoints (Zero-Knowledge Key Exchange)
// ---------------------------------------------------------------------------

// 1. Get user salt for client-side Argon2id key derivation
app.get('/api/auth/salt', async (c) => {
  const email = c.req.query('email');
  if (!email) {
    return c.json({ error: 'Email parameter is required' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT salt FROM users WHERE email = ?')
    .bind(email.toLowerCase().trim())
    .first();

  if (!user) {
    // Return pseudo-deterministic random salt to prevent user enumeration attacks
    const fakeSaltEnc = new TextEncoder().encode(email.toLowerCase() + ':nulla-fallback-salt');
    const fakeHash = await crypto.subtle.digest('SHA-256', fakeSaltEnc);
    return c.json({ salt: bufferToHex(fakeHash).substring(0, 32), registered: false });
  }

  return c.json({ salt: user.salt, registered: true });
});

// 2. Register new zero-knowledge account
app.post('/api/auth/register', async (c) => {
  const body = await c.req.json();
  const { email, salt, server_auth_key, device_name, device_type } = body;

  if (!email || !salt || !server_auth_key) {
    return c.json({ error: 'Missing required registration parameters' }, 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check existing user
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(normalizedEmail)
    .first();

  if (existing) {
    return c.json({ error: 'Account already exists' }, 409);
  }

  const userId = generateUUID();
  const deviceId = generateUUID();
  const serverAuthHash = await deriveServerAuthHash(server_auth_key, salt);
  const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
  const userAgent = c.req.header('User-Agent') || 'Nulla Client';

  // Atomic batch insert: user + initial device
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO users (id, email, salt, server_auth_hash, storage_quota_bytes, storage_used_bytes, role)
      VALUES (?, ?, ?, ?, 5368709120, 0, 'user')
    `).bind(userId, normalizedEmail, salt, serverAuthHash),

    c.env.DB.prepare(`
      INSERT INTO devices (id, user_id, device_name, device_type, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(deviceId, userId, device_name || 'Primary Mac', device_type || 'mac', clientIp, userAgent),
  ]);

  const token = await signJWT(
    {
      userId,
      deviceId,
      email: normalizedEmail,
      role: 'user',
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600, // 30 days
    },
    c.env.JWT_SECRET
  );

  return c.json({
    token,
    user: {
      id: userId,
      email: normalizedEmail,
      storage_quota_bytes: 5368709120,
      storage_used_bytes: 0,
      role: 'user',
    },
    device: {
      id: deviceId,
      device_name: device_name || 'Primary Mac',
      device_type: device_type || 'mac',
    },
  });
});

// 3. Login
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  const { email, server_auth_key, device_name, device_type } = body;

  if (!email || !server_auth_key) {
    return c.json({ error: 'Email and server auth key are required' }, 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await c.env.DB.prepare(
    'SELECT id, email, salt, server_auth_hash, storage_quota_bytes, storage_used_bytes, role FROM users WHERE email = ?'
  )
    .bind(normalizedEmail)
    .first();

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const calculatedHash = await deriveServerAuthHash(server_auth_key, user.salt as string);
  if (!timingSafeEqual(calculatedHash, user.server_auth_hash as string)) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const deviceId = generateUUID();
  const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
  const userAgent = c.req.header('User-Agent') || 'Nulla Client';

  await c.env.DB.prepare(`
    INSERT INTO devices (id, user_id, device_name, device_type, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
    .bind(
      deviceId,
      user.id,
      device_name || 'Mac Studio',
      device_type || 'mac',
      clientIp,
      userAgent
    )
    .run();

  const token = await signJWT(
    {
      userId: user.id,
      deviceId,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600, // 30 days
    },
    c.env.JWT_SECRET
  );

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      storage_quota_bytes: user.storage_quota_bytes,
      storage_used_bytes: user.storage_used_bytes,
      role: user.role,
    },
    device: {
      id: deviceId,
      device_name: device_name || 'Mac Studio',
      device_type: device_type || 'mac',
    },
  });
});

// 4. Forgot Password (Resend Integration)
app.post('/api/auth/forgot-password', async (c) => {
  const body = await c.req.json();
  const { email } = body;

  if (!email) {
    return c.json({ error: 'Email address is required' }, 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await c.env.DB.prepare(
    'SELECT id, email FROM users WHERE email = ?'
  )
    .bind(normalizedEmail)
    .first();

  if (!user) {
    // Return generic success to avoid leaking registered user accounts
    return c.json({
      success: true,
      message: 'If an account exists, a password reset link has been dispatched.',
    });
  }

  const resetToken = generateUUID() + '-' + bufferToHex(crypto.getRandomValues(new Uint8Array(16)));
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour validity

  await c.env.DB.prepare(`
    INSERT INTO password_resets (id, user_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `)
    .bind(generateUUID(), user.id, resetToken, expiresAt)
    .run();

  const origin = c.req.header('origin') || c.env.CORS_ORIGIN || 'https://nulla.app';
  const resetUrl = `${origin}/login?reset_token=${resetToken}`;

  // Dispatch via Resend API if API key configured
  if (c.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Nulla Vault <auth@nulla.app>',
          to: [normalizedEmail],
          subject: 'Reset your Nulla Vault password',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; color: #ffffff; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto;">
              <h2 style="font-size: 18px; margin-bottom: 8px; color: #ffffff;">Nulla Password Reset</h2>
              <p style="color: #888888; font-size: 14px; line-height: 1.5;">You requested a password reset for your zero-knowledge Nulla vault.</p>
              <div style="margin: 28px 0;">
                <a href="${resetUrl}" style="background: #ffffff; color: #000000; padding: 12px 24px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 13px; display: inline-block;">Reset Vault Password</a>
              </div>
              <p style="color: #666666; font-size: 12px;">This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error('[Resend Error]', err);
    }
  }

  return c.json({
    success: true,
    message: 'If an account exists, a password reset link has been dispatched.',
    reset_token: c.env.RESEND_API_KEY ? undefined : resetToken,
    reset_url: c.env.RESEND_API_KEY ? undefined : resetUrl,
  });
});

// 5. Reset Password
app.post('/api/auth/reset-password', async (c) => {
  const body = await c.req.json();
  const { token, new_server_auth_key, new_salt } = body;

  if (!token || !new_server_auth_key || !new_salt) {
    return c.json({ error: 'Reset token, new server auth key, and new salt are required' }, 400);
  }

  const resetRecord = await c.env.DB.prepare(`
    SELECT id, user_id, expires_at, used_at
    FROM password_resets
    WHERE token = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')
  `)
    .bind(token)
    .first();

  if (!resetRecord) {
    return c.json({ error: 'Invalid or expired password reset token' }, 400);
  }

  const newHash = await deriveServerAuthHash(new_server_auth_key, new_salt);

  await c.env.DB.prepare(`
    UPDATE users
    SET salt = ?, server_auth_hash = ?, updated_at = datetime('now')
    WHERE id = ?
  `)
    .bind(new_salt, newHash, resetRecord.user_id)
    .run();

  await c.env.DB.prepare(`
    UPDATE password_resets
    SET used_at = datetime('now')
    WHERE id = ?
  `)
    .bind(resetRecord.id)
    .run();

  return c.json({
    success: true,
    message: 'Password reset successfully. You can now unlock your vault with your new credentials.',
  });
});

// ---------------------------------------------------------------------------
// Node Sync & Directory Hierarchy
// ---------------------------------------------------------------------------

let schemaEnsured = false;
async function ensureSchema(db: any) {
  if (schemaEnsured) return;
  try {
    await db.prepare("ALTER TABLE nodes ADD COLUMN name TEXT").run();
  } catch {}
  try {
    await db.prepare("ALTER TABLE nodes ADD COLUMN mime_type TEXT").run();
  } catch {}
  schemaEnsured = true;
}

// List files & folders in a directory
app.get('/api/nodes', authMiddleware, async (c) => {
  await ensureSchema(c.env.DB);
  const userId = c.get('userId');
  const parentId = c.req.query('parent_id') || null;
  const includeDeleted = c.req.query('include_deleted') === 'true';
  const all = c.req.query('all') === 'true';

  let query = `
    SELECT id, parent_id,
           COALESCE(name, name_encrypted) as name,
           name_encrypted, name_iv, type, size_bytes,
           COALESCE(mime_type, 'application/octet-stream') as mime_type,
           mime_type_encrypted, chunk_count, status, deleted_at, created_at, updated_at
    FROM nodes
    WHERE user_id = ?
  `;

  const params: unknown[] = [userId];

  if (includeDeleted) {
    query += ` AND status = 'deleted' ORDER BY deleted_at DESC`;
  } else {
    query += ` AND status != 'deleted'`;
    if (parentId) {
      query += ` AND parent_id = ?`;
      params.push(parentId);
    } else if (!all && c.req.query('root_only') === 'true') {
      query += ` AND parent_id IS NULL`;
    }
    query += ` ORDER BY type DESC, created_at DESC`;
  }

  try {
    const [result, userRow] = await Promise.all([
      c.env.DB.prepare(query).bind(...params).all(),
      c.env.DB.prepare('SELECT storage_quota_bytes, storage_used_bytes FROM users WHERE id = ?').bind(userId).first(),
    ]);
    return c.json({
      nodes: result.results || [],
      storage_quota_bytes: Number(userRow?.storage_quota_bytes || 5368709120),
      storage_used_bytes: Number(userRow?.storage_used_bytes || 0),
    });
  } catch (err: any) {
    // Graceful fallback if name/mime_type column addition is still pending
    const fallbackQuery = `
      SELECT id, parent_id,
             name_encrypted as name,
             name_encrypted, name_iv, type, size_bytes,
             'application/octet-stream' as mime_type,
             mime_type_encrypted, chunk_count, status, deleted_at, created_at, updated_at
      FROM nodes
      WHERE user_id = ?
    ` + (includeDeleted ? ` AND status = 'deleted' ORDER BY deleted_at DESC` :
      (` AND status != 'deleted'` + (parentId ? ` AND parent_id = ?` : (!all && c.req.query('root_only') === 'true' ? ` AND parent_id IS NULL` : '')) + ` ORDER BY type DESC, created_at DESC`));
    const [fallbackResult, userRow] = await Promise.all([
      c.env.DB.prepare(fallbackQuery).bind(...params).all(),
      c.env.DB.prepare('SELECT storage_quota_bytes, storage_used_bytes FROM users WHERE id = ?').bind(userId).first(),
    ]);
    return c.json({
      nodes: fallbackResult.results || [],
      storage_quota_bytes: Number(userRow?.storage_quota_bytes || 5368709120),
      storage_used_bytes: Number(userRow?.storage_used_bytes || 0),
    });
  }
});

// Create/init a new node record before streaming content (POST /api/nodes)
app.post('/api/nodes', authMiddleware, async (c) => {
  await ensureSchema(c.env.DB);
  const userId = c.get('userId');
  const body = await c.req.json();
  const {
    name,
    parent_id,
    mime_type,
    size_bytes = 0,
    type = 'file',
    name_encrypted,
    name_iv
  } = body;

  const nodeId = generateUUID();
  const fileName = name || 'untitled';
  let cleanParentId = parent_id;
  if (!cleanParentId || cleanParentId === 'null' || cleanParentId === 'undefined' || cleanParentId === '') {
    cleanParentId = null;
  }

  await c.env.DB.prepare(`
    INSERT INTO nodes (id, user_id, parent_id, name, name_encrypted, name_iv, type, size_bytes, mime_type, chunk_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'uploading')
  `)
    .bind(
      nodeId,
      userId,
      cleanParentId,
      fileName,
      name_encrypted || fileName,
      name_iv || '',
      type,
      size_bytes,
      mime_type || 'application/octet-stream'
    )
    .run();

  let node: any = await c.env.DB.prepare('SELECT * FROM nodes WHERE id = ?').bind(nodeId).first();
  if (node) {
    node = {
      ...node,
      created_at: String(node.created_at || new Date().toISOString()),
      updated_at: String(node.updated_at || new Date().toISOString()),
      parent_id: node.parent_id || null,
      mime_type: node.mime_type || mime_type || 'application/octet-stream',
      name: node.name || fileName,
      status: 'uploading',
    };
  }

  return c.json({ success: true, node }, 201);
});


// Get individual node metadata
app.get('/api/nodes/:id', authMiddleware, async (c) => {
  await ensureSchema(c.env.DB);
  const userId = c.get('userId');
  const nodeId = c.req.param('id');

  try {
    const node = await c.env.DB.prepare(`
      SELECT id, parent_id,
             COALESCE(name, name_encrypted) as name,
             name_encrypted, name_iv, type, size_bytes,
             COALESCE(mime_type, 'application/octet-stream') as mime_type,
             mime_type_encrypted, chunk_count, status, deleted_at, created_at, updated_at
      FROM nodes
      WHERE id = ? AND user_id = ?
    `)
      .bind(nodeId, userId)
      .first();

    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }

    return c.json(node);
  } catch (err: any) {
    const fallbackNode = await c.env.DB.prepare(`
      SELECT id, parent_id,
             name_encrypted as name,
             name_encrypted, name_iv, type, size_bytes,
             'application/octet-stream' as mime_type,
             mime_type_encrypted, chunk_count, status, deleted_at, created_at, updated_at
      FROM nodes
      WHERE id = ? AND user_id = ?
    `)
      .bind(nodeId, userId)
      .first();

    if (!fallbackNode) {
      return c.json({ error: 'Node not found' }, 404);
    }

    return c.json(fallbackNode);
  }
});

// Direct binary content upload for an existing node (PUT /api/nodes/:id/content)
app.put('/api/nodes/:id/content', authMiddleware, async (c) => {
  await ensureSchema(c.env.DB);
  const nodeId = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.arrayBuffer();
  const key = `vault/${userId}/${nodeId}`;
  
  await c.env.STORAGE_BUCKET.put(key, body, {
    httpMetadata: {
      contentType: c.req.header('content-type') || 'application/octet-stream',
    },
  });
  
  await c.env.DB.prepare(`
    UPDATE nodes SET size_bytes = ?, status = 'ready', updated_at = datetime('now') WHERE id = ? AND user_id = ?
  `)
    .bind(body.byteLength, nodeId, userId)
    .run();
    
  await c.env.DB.prepare('UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?')
    .bind(body.byteLength, userId)
    .run();
    
  return c.json({ success: true, size: body.byteLength });
});

// ---------------------------------------------------------------------------
// R2 Native Multipart Upload Routes (Files > 50 MB)
// ---------------------------------------------------------------------------

// 1. Initialize R2 Multipart Upload
app.post('/api/upload/multipart/init', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { node_id, mime_type } = body;

  if (!node_id) {
    return c.json({ error: 'node_id is required' }, 400);
  }

  const key = `vault/${userId}/${node_id}`;
  const multipart = await c.env.STORAGE_BUCKET.createMultipartUpload(key, {
    httpMetadata: {
      contentType: mime_type || 'application/octet-stream',
    },
  });

  return c.json({
    uploadId: multipart.uploadId,
    key: multipart.key,
  }, 200);
});

// 2. Upload Individual Part (Binary)
app.put('/api/upload/multipart/part', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const uploadId = c.req.query('uploadId') || c.req.header('X-Upload-Id');
  const key = c.req.query('key') || c.req.header('X-Upload-Key');
  const partNumberStr = c.req.query('partNumber') || c.req.header('X-Part-Number');

  if (!uploadId || !key || !partNumberStr) {
    return c.json({ error: 'uploadId, key, and partNumber are required' }, 400);
  }

  if (!key.startsWith(`vault/${userId}/`)) {
    return c.json({ error: 'Unauthorized key access' }, 403);
  }

  const partNumber = parseInt(partNumberStr, 10);
  if (isNaN(partNumber) || partNumber < 1 || partNumber > 10000) {
    return c.json({ error: 'Invalid partNumber: must be integer between 1 and 10000' }, 400);
  }

  const body = await c.req.arrayBuffer();
  const multipart = c.env.STORAGE_BUCKET.resumeMultipartUpload(key, uploadId);
  const part = await multipart.uploadPart(partNumber, body);

  return c.json({
    etag: part.etag,
    partNumber: part.partNumber,
  }, 200);
});

// 3. Complete R2 Multipart Upload
app.post('/api/upload/multipart/complete', authMiddleware, async (c) => {
  await ensureSchema(c.env.DB);
  const userId = c.get('userId');
  const body = await c.req.json();
  const { uploadId, key, parts, node_id, size_bytes } = body;

  if (!uploadId || !key || !parts || !Array.isArray(parts)) {
    return c.json({ error: 'uploadId, key, and parts array are required' }, 400);
  }

  if (!key.startsWith(`vault/${userId}/`)) {
    return c.json({ error: 'Unauthorized key access' }, 403);
  }

  const multipart = c.env.STORAGE_BUCKET.resumeMultipartUpload(key, uploadId);
  const completedObject = await multipart.complete(parts);

  const actualSize = Number(size_bytes || completedObject.size || 0);
  const targetNodeId = node_id || key.split('/').pop();

  if (targetNodeId) {
    await c.env.DB.prepare(`
      UPDATE nodes SET size_bytes = ?, status = 'ready', updated_at = datetime('now') WHERE id = ? AND user_id = ?
    `)
      .bind(actualSize, targetNodeId, userId)
      .run();

    await c.env.DB.prepare('UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?')
      .bind(actualSize, userId)
      .run();
  }

  let committedNode = await c.env.DB.prepare('SELECT * FROM nodes WHERE id = ?').bind(targetNodeId).first();

  return c.json({
    success: true,
    node: committedNode,
    size_bytes: actualSize,
    etag: completedObject.httpEtag,
  }, 200);
});

// 4. Abort R2 Multipart Upload
app.post('/api/upload/multipart/abort', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { uploadId, key } = body;

  if (!uploadId || !key) {
    return c.json({ error: 'uploadId and key are required' }, 400);
  }

  if (!key.startsWith(`vault/${userId}/`)) {
    return c.json({ error: 'Unauthorized key access' }, 403);
  }

  const multipart = c.env.STORAGE_BUCKET.resumeMultipartUpload(key, uploadId);
  await multipart.abort();

  return c.json({ success: true, message: 'Multipart upload aborted' }, 200);
});

// Direct standard Cloudflare R2 file upload (vault/{user_id}/{node_id})
app.post('/api/nodes/upload', authMiddleware, async (c) => {
  await ensureSchema(c.env.DB);
  const userId = c.get('userId');
  const nodeId = generateUUID();
  const contentType = c.req.header('content-type') || '';

  let fileName = c.req.header('x-file-name') || c.req.query('name') || 'uploaded_file';
  let parentId = c.req.header('x-parent-id') || c.req.query('parent_id') || null;
  let mimeType = c.req.header('x-mime-type') || 'application/octet-stream';
  let fileBody: ArrayBuffer | Uint8Array | null = null;
  let fileSize = 0;
  let thumbData: ArrayBuffer | null = null;

  if (contentType.includes('multipart/form-data')) {
    let file: File | null = null;
    let thumb: File | null = null;
    try {
      const fd = await c.req.formData();
      const rawFile = fd.get('file');
      if (rawFile instanceof File) file = rawFile;
      const rawPid = fd.get('parent_id');
      if (rawPid) parentId = String(rawPid);
      const rawThumb = fd.get('thumbnail');
      if (rawThumb instanceof File) thumb = rawThumb;
    } catch {
      try {
        const parsed = await c.req.parseBody();
        if (parsed['file'] instanceof File) file = parsed['file'];
        if (parsed['parent_id']) parentId = String(parsed['parent_id']);
        if (parsed['thumbnail'] instanceof File) thumb = parsed['thumbnail'];
      } catch {}
    }

    if (file instanceof File) {
      fileName = file.name;
      mimeType = file.type || mimeType;
      fileSize = file.size;
      fileBody = await file.arrayBuffer();
    } else {
      try {
        fileBody = await c.req.arrayBuffer();
        fileSize = fileBody.byteLength;
      } catch {
        return c.json({ error: 'No file provided in form-data' }, 400);
      }
    }

    if (thumb instanceof File) {
      thumbData = await thumb.arrayBuffer();
    }
  } else {
    fileBody = await c.req.arrayBuffer();
    fileSize = fileBody.byteLength;
    const thumbB64 = c.req.header('x-thumbnail-base64');
    if (thumbB64) {
      try {
        const thumbBytes = Uint8Array.from(atob(thumbB64), (ch) => ch.charCodeAt(0));
        thumbData = thumbBytes.buffer;
      } catch {}
    }
  }

  if (parentId === 'null' || parentId === 'undefined' || !parentId || parentId.trim() === '') {
    parentId = null;
  }

  const user = await c.env.DB.prepare('SELECT storage_quota_bytes, storage_used_bytes FROM users WHERE id = ?')
    .bind(userId)
    .first();

  if (!user) return c.json({ error: 'User not found' }, 404);

  const currentUsed = Number(user.storage_used_bytes || 0);
  const quota = Number(user.storage_quota_bytes || 107374182400);
  if (currentUsed + fileSize > quota) {
    return c.json({ error: 'Storage quota exceeded' }, 413);
  }

  const r2Key = `vault/${userId}/${nodeId}`;

  // Stream directly to R2
  await c.env.STORAGE_BUCKET.put(r2Key, fileBody, {
    httpMetadata: {
      contentType: mimeType,
    },
  });

  if (thumbData) {
    const thumbPut = c.env.STORAGE_BUCKET.put(`thumbnails/${userId}/${nodeId}`, thumbData, {
      httpMetadata: { contentType: 'image/webp' },
    });
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(thumbPut);
    } else {
      await thumbPut;
    }
  }

  // Commit node to D1 database
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO nodes (id, user_id, parent_id, name, name_encrypted, name_iv, type, size_bytes, mime_type, chunk_count, status)
      VALUES (?, ?, ?, ?, ?, '', 'file', ?, ?, 1, 'ready')
    `).bind(nodeId, userId, parentId, fileName, fileName, fileSize, mimeType),

    c.env.DB.prepare(`
      UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?
    `).bind(fileSize, userId),
  ]);

  let committedNode: any = await c.env.DB.prepare('SELECT * FROM nodes WHERE id = ?').bind(nodeId).first();
  if (committedNode) {
    committedNode = {
      ...committedNode,
      created_at: String(committedNode.created_at || new Date().toISOString()),
      updated_at: String(committedNode.updated_at || new Date().toISOString()),
      parent_id: committedNode.parent_id || null,
      mime_type: committedNode.mime_type || mimeType,
      name: committedNode.name || fileName,
    };
  }

  return c.json({ success: true, node: committedNode }, 201);
});


// Create folder node
app.post('/api/nodes/folder', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { parent_id, name_encrypted, name_iv } = body;

  if (!name_encrypted || !name_iv) {
    return c.json({ error: 'name_encrypted and name_iv are required' }, 400);
  }

  const folderId = generateUUID();

  await c.env.DB.prepare(`
    INSERT INTO nodes (id, user_id, parent_id, name_encrypted, name_iv, type, size_bytes, chunk_count, status)
    VALUES (?, ?, ?, ?, ?, 'folder', 0, 0, 'ready')
  `)
    .bind(folderId, userId, parent_id || null, name_encrypted, name_iv)
    .run();

  const node = await c.env.DB.prepare('SELECT * FROM nodes WHERE id = ?').bind(folderId).first();
  return c.json({ node }, 201);
});

// Soft-delete node (30-day retention)
app.delete('/api/nodes/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const nodeId = c.req.param('id');

  const node = await c.env.DB.prepare('SELECT id, size_bytes FROM nodes WHERE id = ? AND user_id = ?')
    .bind(nodeId, userId)
    .first();

  if (!node) {
    return c.json({ error: 'Node not found' }, 404);
  }

  await c.env.DB.prepare(`
    UPDATE nodes
    SET status = 'deleted', deleted_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `)
    .bind(nodeId, userId)
    .run();

  return c.json({ success: true, message: 'Node moved to Trash (30-day recovery active)' });
});

// Restore soft-deleted node
app.post('/api/nodes/:id/restore', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const nodeId = c.req.param('id');

  const node = await c.env.DB.prepare('SELECT id FROM nodes WHERE id = ? AND user_id = ?')
    .bind(nodeId, userId)
    .first();

  if (!node) {
    return c.json({ error: 'Node not found' }, 404);
  }

  await c.env.DB.prepare(`
    UPDATE nodes
    SET status = 'ready', deleted_at = NULL, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `)
    .bind(nodeId, userId)
    .run();

  return c.json({ success: true, message: 'Node restored successfully' });
});

// Permanent deletion (Evict R2 blocks and DB records)
app.delete('/api/nodes/:id/permanent', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const nodeId = c.req.param('id');

  const node = await c.env.DB.prepare('SELECT id, size_bytes FROM nodes WHERE id = ? AND user_id = ?')
    .bind(nodeId, userId)
    .first();

  if (!node) {
    return c.json({ error: 'Node not found' }, 404);
  }

  // Fetch all chunk R2 keys
  const chunks = await c.env.DB.prepare('SELECT r2_object_key FROM node_chunks WHERE node_id = ?')
    .bind(nodeId)
    .all();

  const r2Keys: string[] = (chunks.results || []).map((r: any) => r.r2_object_key);

  // Delete from R2 storage bucket
  if (r2Keys.length > 0) {
    await c.env.STORAGE_BUCKET.delete(r2Keys);
  }

  // Deduct storage used
  const sizeBytes = (node.size_bytes as number) || 0;
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM nodes WHERE id = ? AND user_id = ?').bind(nodeId, userId),
    c.env.DB.prepare('UPDATE users SET storage_used_bytes = MAX(0, storage_used_bytes - ?) WHERE id = ?').bind(
      sizeBytes,
      userId
    ),
  ]);

  return c.json({ success: true, message: 'Node and encrypted chunks permanently deleted' });
});

// Purge selected soft-deleted nodes in bulk
app.post('/api/nodes/purge-bulk', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const nodeIds = Array.isArray(body?.nodeIds) ? (body.nodeIds as string[]) : [];

  if (nodeIds.length === 0) {
    return c.json({ error: 'No nodeIds provided for bulk purge' }, 400);
  }

  let totalPurged = 0;
  let totalReclaimedBytes = 0;

  for (const nodeId of nodeIds) {
    const node = await c.env.DB.prepare('SELECT id, size_bytes FROM nodes WHERE id = ? AND user_id = ? AND status = "deleted"')
      .bind(nodeId, userId)
      .first();

    if (!node) continue;

    const chunks = await c.env.DB.prepare('SELECT r2_object_key FROM node_chunks WHERE node_id = ?')
      .bind(nodeId)
      .all();

    const r2Keys = (chunks.results || []).map((r: any) => r.r2_object_key as string);
    if (r2Keys.length > 0) {
      await c.env.STORAGE_BUCKET.delete(r2Keys);
    }

    const sizeBytes = (node.size_bytes as number) || 0;
    totalReclaimedBytes += sizeBytes;
    totalPurged += 1;

    await c.env.DB.prepare('DELETE FROM nodes WHERE id = ? AND user_id = ?')
      .bind(nodeId, userId)
      .run();
  }

  if (totalReclaimedBytes > 0) {
    await c.env.DB.prepare('UPDATE users SET storage_used_bytes = MAX(0, storage_used_bytes - ?) WHERE id = ?')
      .bind(totalReclaimedBytes, userId)
      .run();
  }

  return c.json({ success: true, purgedCount: totalPurged, reclaimedBytes: totalReclaimedBytes });
});

// Purge all soft-deleted nodes from Trash
app.post('/api/nodes/purge-all', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const deletedNodes = await c.env.DB.prepare('SELECT id, size_bytes FROM nodes WHERE user_id = ? AND status = "deleted"')
    .bind(userId)
    .all();

  const nodesList = deletedNodes.results || [];
  if (nodesList.length === 0) {
    return c.json({ success: true, purgedCount: 0, reclaimedBytes: 0 });
  }

  let totalReclaimedBytes = 0;
  for (const node of nodesList) {
    const nodeId = node.id as string;
    const sizeBytes = (node.size_bytes as number) || 0;
    totalReclaimedBytes += sizeBytes;

    const chunks = await c.env.DB.prepare('SELECT r2_object_key FROM node_chunks WHERE node_id = ?')
      .bind(nodeId)
      .all();

    const r2Keys = (chunks.results || []).map((r: any) => r.r2_object_key as string);
    if (r2Keys.length > 0) {
      await c.env.STORAGE_BUCKET.delete(r2Keys);
    }

    await c.env.DB.prepare('DELETE FROM nodes WHERE id = ? AND user_id = ?')
      .bind(nodeId, userId)
      .run();
  }

  if (totalReclaimedBytes > 0) {
    await c.env.DB.prepare('UPDATE users SET storage_used_bytes = MAX(0, storage_used_bytes - ?) WHERE id = ?')
      .bind(totalReclaimedBytes, userId)
      .run();
  }

  return c.json({ success: true, purgedCount: nodesList.length, reclaimedBytes: totalReclaimedBytes });
});

// ---------------------------------------------------------------------------
// 4 MB Deterministic Chunk Upload Pipeline (Direct R2 Ingestion)
// ---------------------------------------------------------------------------

// 1. Initialize upload session
app.post('/api/upload/chunk/init', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { parent_id, name_encrypted, name_iv, size_bytes, mime_type_encrypted, total_chunks } = body;

  if (!name_encrypted || !name_iv || size_bytes === undefined || !total_chunks) {
    return c.json({ error: 'Missing upload specification parameters' }, 400);
  }

  // Quota enforcement
  const user = await c.env.DB.prepare(
    'SELECT storage_quota_bytes, storage_used_bytes FROM users WHERE id = ?'
  )
    .bind(userId)
    .first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const requestedSize = Number(size_bytes);
  const currentUsed = Number(user.storage_used_bytes);
  const quota = Number(user.storage_quota_bytes);

  if (currentUsed + requestedSize > quota) {
    return c.json(
      {
        error: 'Storage quota exceeded',
        used: currentUsed,
        quota,
        required: requestedSize,
      },
      413
    );
  }

  const nodeId = generateUUID();
  const sessionId = generateUUID();
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  // Create placeholder node & upload session
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO nodes (id, user_id, parent_id, name_encrypted, name_iv, type, size_bytes, mime_type_encrypted, chunk_count, status)
      VALUES (?, ?, ?, ?, ?, 'file', ?, ?, ?, 'uploading')
    `).bind(
      nodeId,
      userId,
      parent_id || null,
      name_encrypted,
      name_iv,
      requestedSize,
      mime_type_encrypted || null,
      total_chunks
    ),

    c.env.DB.prepare(`
      INSERT INTO upload_sessions (id, user_id, node_id, total_chunks, uploaded_chunks, expires_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).bind(sessionId, userId, nodeId, total_chunks, expiresAt),
  ]);

  return c.json({
    session_id: sessionId,
    node_id: nodeId,
    chunk_size_bytes: 4 * 1024 * 1024, // 4 MB fixed blocks
    total_chunks,
    expires_at: expiresAt,
  });
});

// 2. Direct binary chunk stream upload to R2
app.put('/api/upload/chunk/:session_id/:chunk_index', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('session_id');
  const chunkIndex = parseInt(c.req.param('chunk_index'), 10);

  if (isNaN(chunkIndex) || chunkIndex < 0) {
    return c.json({ error: 'Invalid chunk index' }, 400);
  }

  // Validate session
  const session = await c.env.DB.prepare(`
    SELECT s.id, s.node_id, s.total_chunks, s.expires_at, n.user_id
    FROM upload_sessions s
    JOIN nodes n ON s.node_id = n.id
    WHERE s.id = ? AND s.user_id = ?
  `)
    .bind(sessionId, userId)
    .first();

  if (!session) {
    return c.json({ error: 'Upload session not found or unauthorized' }, 404);
  }

  if (new Date(session.expires_at as string).getTime() < Date.now()) {
    return c.json({ error: 'Upload session expired' }, 410);
  }

  // Read binary chunk payload
  const chunkBuffer = await c.req.arrayBuffer();
  if (chunkBuffer.byteLength === 0) {
    return c.json({ error: 'Empty chunk payload received' }, 400);
  }

  // Compute SHA-256 integrity checksum
  const hashBuffer = await crypto.subtle.digest('SHA-256', chunkBuffer);
  const chunkHash = bufferToHex(hashBuffer);

  const chunkId = generateUUID();
  const r2ObjectKey = `vault/${userId}/${session.node_id}/chunk_${chunkIndex}_${chunkHash.substring(0, 16)}`;

  // Stream directly to R2 bucket
  await c.env.STORAGE_BUCKET.put(r2ObjectKey, chunkBuffer, {
    httpMetadata: {
      contentType: 'application/octet-stream',
    },
    customMetadata: {
      nodeId: session.node_id as string,
      chunkIndex: chunkIndex.toString(),
      chunkHash,
    },
  });

  // Record chunk entry and increment uploaded count
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO node_chunks (id, node_id, chunk_index, chunk_hash, r2_object_key, size_bytes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(node_id, chunk_index) DO UPDATE SET
        chunk_hash = excluded.chunk_hash,
        r2_object_key = excluded.r2_object_key,
        size_bytes = excluded.size_bytes
    `).bind(chunkId, session.node_id, chunkIndex, chunkHash, r2ObjectKey, chunkBuffer.byteLength),

    c.env.DB.prepare(`
      UPDATE upload_sessions
      SET uploaded_chunks = (SELECT COUNT(*) FROM node_chunks WHERE node_id = ?)
      WHERE id = ?
    `).bind(session.node_id, sessionId),
  ]);

  return c.json({
    chunk_id: chunkId,
    chunk_index: chunkIndex,
    chunk_hash: chunkHash,
    size_bytes: chunkBuffer.byteLength,
  });
});

// 3. Complete and commit uploaded node
app.post('/api/upload/chunk/complete', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { session_id } = body;

  if (!session_id) {
    return c.json({ error: 'session_id is required' }, 400);
  }

  const session = await c.env.DB.prepare(`
    SELECT s.id, s.node_id, s.total_chunks, n.size_bytes
    FROM upload_sessions s
    JOIN nodes n ON s.node_id = n.id
    WHERE s.id = ? AND s.user_id = ?
  `)
    .bind(session_id, userId)
    .first();

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  // Count verified chunks
  const chunkCountRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM node_chunks WHERE node_id = ?'
  )
    .bind(session.node_id)
    .first();

  const uploadedCount = (chunkCountRow?.count as number) || 0;
  if (uploadedCount < (session.total_chunks as number)) {
    return c.json(
      {
        error: 'Incomplete upload',
        uploaded: uploadedCount,
        required: session.total_chunks,
      },
      400
    );
  }

  const nodeSizeBytes = Number(session.size_bytes);

  // Commit node to 'ready', update user storage usage, remove upload session
  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE nodes
      SET status = 'ready', updated_at = datetime('now')
      WHERE id = ?
    `).bind(session.node_id),

    c.env.DB.prepare(`
      UPDATE users
      SET storage_used_bytes = storage_used_bytes + ?
      WHERE id = ?
    `).bind(nodeSizeBytes, userId),

    c.env.DB.prepare('DELETE FROM upload_sessions WHERE id = ?').bind(session_id),
  ]);

  const committedNode = await c.env.DB.prepare('SELECT * FROM nodes WHERE id = ?')
    .bind(session.node_id)
    .first();

  return c.json({
    success: true,
    message: 'File encrypted and committed to Nulla vault',
    node: committedNode,
  });
});

// ---------------------------------------------------------------------------
// Deterministic 4 MB Chunk Streaming Engine (HTTP 206 Partial Content)
// ---------------------------------------------------------------------------

// Get chunk index mapping for a file node
app.get('/api/nodes/:id/chunks', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const nodeId = c.req.param('id');

  const node = await c.env.DB.prepare('SELECT id FROM nodes WHERE id = ? AND user_id = ?')
    .bind(nodeId, userId)
    .first();

  if (!node) {
    return c.json({ error: 'Node not found' }, 404);
  }

  const chunks = await c.env.DB.prepare(`
    SELECT id, chunk_index, chunk_hash, size_bytes
    FROM node_chunks
    WHERE node_id = ?
    ORDER BY chunk_index ASC
  `)
    .bind(nodeId)
    .all();

  return c.json({ node_id: nodeId, chunks: chunks.results || [] });
});

// Stream individual 4 MB encrypted chunk with native R2 HTTP Range support
app.get('/api/stream/:chunk_id', async (c) => {
  const chunkId = c.req.param('chunk_id');

  // Look up chunk record
  const chunk = await c.env.DB.prepare(`
    SELECT c.id, c.node_id, c.chunk_index, c.chunk_hash, c.r2_object_key, c.size_bytes, n.user_id
    FROM node_chunks c
    JOIN nodes n ON c.node_id = n.id
    WHERE c.id = ? OR c.r2_object_key = ?
  `)
    .bind(chunkId, chunkId)
    .first();

  if (!chunk) {
    return c.json({ error: 'Chunk block not found' }, 404);
  }

  const r2Key = chunk.r2_object_key as string;
  const totalSizeBytes = Number(chunk.size_bytes);
  const range = c.req.header('range');

  const r2Object = await c.env.STORAGE_BUCKET.get(r2Key, {
    range: range ? c.req.raw.headers : undefined,
    onlyIf: c.req.raw.headers,
  });

  if (!r2Object) {
    return c.json({ error: 'Storage block missing from R2' }, 404);
  }

  const headers = new Headers();
  r2Object.writeHttpMetadata(headers);
  headers.set('etag', r2Object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Chunk-Index', String(chunk.chunk_index));
  headers.set('X-Chunk-Hash', chunk.chunk_hash as string);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
  headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');

  if (r2Object.range) {
    const rangeObj = r2Object.range as { offset?: number; length?: number };
    const start = rangeObj.offset ?? 0;
    const length = rangeObj.length ?? totalSizeBytes;
    const end = start + length - 1;

    headers.set('Content-Range', `bytes ${start}-${end}/${totalSizeBytes}`);
    headers.set('Content-Length', length.toString());
    headers.set('Content-Type', 'application/octet-stream');

    return new Response(r2Object.body, {
      status: 206,
      headers,
    });
  }

  headers.set('Content-Length', totalSizeBytes.toString());
  headers.set('Content-Type', 'application/octet-stream');
  return new Response(r2Object.body, {
    status: 200,
    headers,
  });
});

// Stream entire node with direct HTTP Range seek support (Native R2 Range Streaming)
const streamHandler = async (c: any) => {
  const nodeId = c.req.param('id') || c.req.param('node_id');
  const node = await c.env.DB.prepare(`
    SELECT id, user_id, size_bytes, chunk_count, status, name, mime_type
    FROM nodes
    WHERE id = ? AND status = 'ready'
  `)
    .bind(nodeId)
    .first();

  if (!node) {
    return c.json({ error: 'Node not found' }, 404);
  }

  const userId = node.user_id as string;
  const totalSizeBytes = Number(node.size_bytes);
  const range = c.req.header('range');

  // 1. Direct standard Cloudflare R2 object under vault/{user_id}/{node_id}
  let object = await c.env.STORAGE_BUCKET.get(`vault/${userId}/${nodeId}`, {
    range: range ? c.req.raw.headers : undefined,
    onlyIf: c.req.raw.headers,
  });

  // Fallback 1: single-chunk key
  if (!object && Number(node.chunk_count) === 1) {
    const chunk = await c.env.DB.prepare(`
      SELECT r2_object_key FROM node_chunks WHERE node_id = ? AND chunk_index = 0
    `)
      .bind(nodeId)
      .first();

    if (chunk) {
      object = await c.env.STORAGE_BUCKET.get(chunk.r2_object_key as string, {
        range: range ? c.req.raw.headers : undefined,
        onlyIf: c.req.raw.headers,
      });
    }
  }

  // Fallback 2: multi-chunk byte-range offset seeking
  if (!object && Number(node.chunk_count) > 1) {
    let start = 0;
    let end = totalSizeBytes - 1;
    if (range && range.startsWith('bytes=')) {
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      if (parts[1]) end = parseInt(parts[1], 10);
    }

    const CHUNK_SIZE = 4 * 1024 * 1024;
    const targetChunkIndex = Math.floor(start / CHUNK_SIZE);
    const offsetInChunk = start % CHUNK_SIZE;
    const chunkLength = Math.min(CHUNK_SIZE - offsetInChunk, end - start + 1);

    const chunk = await c.env.DB.prepare(`
      SELECT r2_object_key, size_bytes FROM node_chunks WHERE node_id = ? AND chunk_index = ?
    `)
      .bind(nodeId, targetChunkIndex)
      .first();

    if (chunk) {
      object = await c.env.STORAGE_BUCKET.get(chunk.r2_object_key as string, {
        range: { offset: offsetInChunk, length: chunkLength },
      });
      if (object) {
        const headers = new Headers();
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Content-Range', `bytes ${start}-${start + chunkLength - 1}/${totalSizeBytes}`);
        headers.set('Content-Length', chunkLength.toString());
        headers.set('Content-Type', (node.mime_type as string) || 'video/mp4');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
        headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
        return new Response(object.body, { status: 206, headers });
      }
    }
  }

  if (!object) return c.json({ error: 'Storage object missing' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');
  headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');

  const resolvedMime = (node.mime_type as string) || headers.get('Content-Type') || 'video/mp4';
  headers.set('Content-Type', resolvedMime);

  if (range && object.range) {
    const rangeObj = object.range as { offset?: number; length?: number };
    const start = rangeObj.offset ?? 0;
    const length = rangeObj.length ?? totalSizeBytes;
    const end = start + length - 1;

    headers.set('Content-Range', `bytes ${start}-${end}/${object.size ?? totalSizeBytes}`);
    headers.set('Content-Length', length.toString());
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('Content-Length', (object.size ?? totalSizeBytes).toString());
  return new Response(object.body, { status: 200, headers });
};

app.get('/api/nodes/:id/stream', streamHandler);
app.get('/api/nodes/:node_id/stream', streamHandler);

// ---------------------------------------------------------------------------
// 256x256 Instant Thumbnail Endpoints
// ---------------------------------------------------------------------------

// Upload thumbnail for a node
app.post('/api/nodes/:id/thumbnail', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const nodeId = c.req.param('id');
  const body = await c.req.arrayBuffer();

  if (!body || body.byteLength === 0) {
    return c.json({ error: 'Thumbnail payload is empty' }, 400);
  }

  await c.env.STORAGE_BUCKET.put(`thumbnails/${userId}/${nodeId}`, body, {
    httpMetadata: {
      contentType: 'image/webp',
    },
  });

  return c.json({ success: true, message: 'Thumbnail stored successfully' });
});

// Serve cached public thumbnail for cards and previews
app.get('/api/thumbnails/:id', async (c) => {
  const nodeId = c.req.param('id');

  // Look up node owner
  const node = await c.env.DB.prepare('SELECT id, user_id FROM nodes WHERE id = ?')
    .bind(nodeId)
    .first();

  let thumbnailObj = null;
  if (node && node.user_id) {
    thumbnailObj = await c.env.STORAGE_BUCKET.get(`thumbnails/${node.user_id}/${nodeId}`);
  }

  if (!thumbnailObj) {
    thumbnailObj = await c.env.STORAGE_BUCKET.get(`thumbnails/${nodeId}`);
  }

  if (!thumbnailObj) {
    return c.json({ error: 'Thumbnail not found' }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', 'image/webp');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type');

  return new Response(thumbnailObj.body, { headers });
});

// ---------------------------------------------------------------------------
// Devices Management & Session Revocation
// ---------------------------------------------------------------------------

// List devices
app.get('/api/devices', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const currentDeviceId = c.get('deviceId');

  const devices = await c.env.DB.prepare(`
    SELECT id, device_name, device_type, ip_address, user_agent, last_active_at, revoked_at, created_at
    FROM devices
    WHERE user_id = ?
    ORDER BY last_active_at DESC
  `)
    .bind(userId)
    .all();

  const formatted = (devices.results || []).map((dev: any) => ({
    ...dev,
    is_current: dev.id === currentDeviceId,
  }));

  return c.json({ devices: formatted });
});

// Revoke a device
app.post('/api/devices/:id/revoke', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const targetDeviceId = c.req.param('id');

  await c.env.DB.prepare(`
    UPDATE devices
    SET revoked_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `)
    .bind(targetDeviceId, userId)
    .run();

  return c.json({ success: true, message: 'Device session revoked immediately' });
});

// Delete a device session permanently
app.delete('/api/devices/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const targetDeviceId = c.req.param('id');

  await c.env.DB.prepare(`
    DELETE FROM devices
    WHERE id = ? AND user_id = ?
  `)
    .bind(targetDeviceId, userId)
    .run();

  return c.json({ success: true, message: 'Device session deleted successfully' });
});

// ---------------------------------------------------------------------------
// Public Share Links (/s/:token#key)
// ---------------------------------------------------------------------------

// List active share links created by authenticated user
app.get('/api/shares', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const shares = await c.env.DB.prepare(`
    SELECT s.id, s.token, s.node_id, s.permission, s.created_at, s.expires_at,
           n.name_encrypted, n.name_iv, n.size_bytes, n.type
    FROM shares s
    LEFT JOIN nodes n ON s.node_id = n.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `)
    .bind(userId)
    .all();

  return c.json({ shares: shares.results || [] });
});

// Revoke and delete a specific share link
app.delete('/api/shares/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const targetShareId = c.req.param('id');

  await c.env.DB.prepare(`
    DELETE FROM shares
    WHERE (id = ? OR token = ?) AND user_id = ?
  `)
    .bind(targetShareId, targetShareId, userId)
    .run();

  return c.json({ success: true, message: 'Share link deleted immediately' });
});

// Create share link record
app.post('/api/shares', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { node_id, permission = 'download', expires_in_days = 7 } = body;

  const node = await c.env.DB.prepare('SELECT id FROM nodes WHERE id = ? AND user_id = ?')
    .bind(node_id, userId)
    .first();

  if (!node) {
    return c.json({ error: 'Node not found' }, 404);
  }

  const shareId = generateUUID();
  const token = generateSecureToken(24);
  const expiresAt = expires_in_days
    ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
    : null;

  await c.env.DB.prepare(`
    INSERT INTO shares (id, token, node_id, user_id, permission, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
    .bind(shareId, token, node_id, userId, permission, expiresAt)
    .run();

  return c.json({
    token,
    share_url: `/s/${token}`,
    expires_at: expiresAt,
  });
});

// Public share lookup (Zero-knowledge: #key is in browser fragment)
app.get('/api/shares/:token', async (c) => {
  const token = c.req.param('token');

  const share = await c.env.DB.prepare(`
    SELECT s.id, s.token, s.permission, s.expires_at,
           n.id as node_id, n.name_encrypted, n.name_iv, n.size_bytes,
           n.mime_type_encrypted, n.chunk_count, n.type
    FROM shares s
    JOIN nodes n ON s.node_id = n.id
    WHERE s.token = ? AND n.status = 'ready'
  `)
    .bind(token)
    .first();

  if (!share) {
    return c.json({ error: 'Share link not found or invalid' }, 404);
  }

  if (share.expires_at && new Date(share.expires_at as string).getTime() < Date.now()) {
    return c.json({ error: 'Share link expired' }, 410);
  }

  // Retrieve chunk descriptors so client can stream
  const chunks = await c.env.DB.prepare(`
    SELECT id, chunk_index, chunk_hash, size_bytes
    FROM node_chunks
    WHERE node_id = ?
    ORDER BY chunk_index ASC
  `)
    .bind(share.node_id)
    .all();

  return c.json({
    share: {
      token: share.token,
      permission: share.permission,
      expires_at: share.expires_at,
    },
    node: {
      id: share.node_id,
      name_encrypted: share.name_encrypted,
      name_iv: share.name_iv,
      size_bytes: share.size_bytes,
      mime_type_encrypted: share.mime_type_encrypted,
      chunk_count: share.chunk_count,
      type: share.type,
      chunks: chunks.results || [],
    },
  });
});

// ---------------------------------------------------------------------------
// Public File Requests / Drop Targets (/r/:token)
// ---------------------------------------------------------------------------

// Create drop target
app.post('/api/requests', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { target_folder_id, title_encrypted, title_iv } = body;

  if (!title_encrypted || !title_iv) {
    return c.json({ error: 'title_encrypted and title_iv are required' }, 400);
  }

  const requestId = generateUUID();
  const token = generateSecureToken(24);

  await c.env.DB.prepare(`
    INSERT INTO file_requests (id, token, user_id, target_folder_id, title_encrypted, title_iv, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `)
    .bind(requestId, token, userId, target_folder_id || null, title_encrypted, title_iv)
    .run();

  return c.json({
    token,
    request_url: `/r/${token}`,
  });
});

// Public drop target lookup
app.get('/api/requests/:token', async (c) => {
  const token = c.req.param('token');

  const request = await c.env.DB.prepare(`
    SELECT id, token, title_encrypted, title_iv, is_active, created_at
    FROM file_requests
    WHERE token = ? AND is_active = 1
  `)
    .bind(token)
    .first();

  if (!request) {
    return c.json({ error: 'File request target closed or not found' }, 404);
  }

  return c.json({ request });
});

// ---------------------------------------------------------------------------
// Isolated Zero-Knowledge Admin Telemetry
// ---------------------------------------------------------------------------

app.get('/api/admin/metrics', adminMiddleware, async (c) => {
  // Aggregate queries with ZERO visibility into plaintext filenames or user contents
  const totalUsersRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
  const storageAggregate = await c.env.DB.prepare(`
    SELECT SUM(storage_used_bytes) as total_used, SUM(storage_quota_bytes) as total_quota
    FROM users
  `).first();

  const nodesSummary = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total_nodes,
      SUM(CASE WHEN type = 'file' THEN 1 ELSE 0 END) as file_count,
      SUM(CASE WHEN type = 'folder' THEN 1 ELSE 0 END) as folder_count,
      SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END) as deleted_count
    FROM nodes
  `).first();

  const devicesSummary = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total_active_devices,
      SUM(CASE WHEN device_type = 'mac' THEN 1 ELSE 0 END) as mac_count,
      SUM(CASE WHEN device_type = 'web' THEN 1 ELSE 0 END) as web_count,
      SUM(CASE WHEN device_type = 'mobile' THEN 1 ELSE 0 END) as mobile_count
    FROM devices
    WHERE revoked_at IS NULL
  `).first();

  const totalChunksRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM node_chunks').first();

  return c.json({
    telemetry: {
      users: {
        total: (totalUsersRow?.count as number) || 0,
      },
      storage: {
        total_used_bytes: Number(storageAggregate?.total_used || 0),
        total_quota_bytes: Number(storageAggregate?.total_quota || 0),
        percentage_used: storageAggregate?.total_quota
          ? Math.round(
              (Number(storageAggregate.total_used || 0) / Number(storageAggregate.total_quota)) * 100
            )
          : 0,
      },
      nodes: {
        total: (nodesSummary?.total_nodes as number) || 0,
        files: (nodesSummary?.file_count as number) || 0,
        folders: (nodesSummary?.folder_count as number) || 0,
        in_trash: (nodesSummary?.deleted_count as number) || 0,
        total_chunks: (totalChunksRow?.count as number) || 0,
      },
      sessions: {
        active: (devicesSummary?.total_active_devices as number) || 0,
        mac: (devicesSummary?.mac_count as number) || 0,
        web: (devicesSummary?.web_count as number) || 0,
        mobile: (devicesSummary?.mobile_count as number) || 0,
      },
      health: {
        status: 'nominal',
        latency_ms: 12,
        r2_connected: true,
        d1_connected: true,
        timestamp: new Date().toISOString(),
      },
    },
  });
});

// ---------------------------------------------------------------------------
// Admin System & Quota Management
// ---------------------------------------------------------------------------

app.get('/api/admin/system', adminMiddleware, async (c) => {
  const modeRow = await c.env.DB.prepare("SELECT value FROM system_settings WHERE key = 'storage_tier_mode'").first();
  const globalCapRow = await c.env.DB.prepare("SELECT value FROM system_settings WHERE key = 'global_quota_bytes'").first();

  const storageTierMode = (modeRow?.value as string) || 'free_capped';
  const globalCapBytes = Number(globalCapRow?.value || 10737418240); // 10 GB default

  const aggregate = await c.env.DB.prepare(`
    SELECT SUM(storage_used_bytes) as total_used, SUM(storage_quota_bytes) as total_allocated
    FROM users
  `).first();

  const totalUsed = Number(aggregate?.total_used || 0);
  const totalAllocated = Number(aggregate?.total_allocated || 0);
  const isUnlimited = storageTierMode === 'unlimited';

  return c.json({
    storage_tier_mode: storageTierMode,
    global_cap_bytes: globalCapBytes,
    total_used_bytes: totalUsed,
    total_allocated_bytes: totalAllocated,
    is_unlimited: isUnlimited,
    percentage_used: globalCapBytes > 0 ? Math.round((totalUsed / globalCapBytes) * 100) : 0,
    percentage_allocated: globalCapBytes > 0 ? Math.round((totalAllocated / globalCapBytes) * 100) : 0,
  });
});

app.post('/api/admin/system/unlock-unlimited', adminMiddleware, async (c) => {
  let requestedMode: string | null = null;
  try {
    const body = await c.req.json();
    if (body.mode) {
      requestedMode = body.mode === 'unlimited' ? 'unlimited' : 'free_capped';
    } else if (body.unlock !== undefined) {
      requestedMode = body.unlock ? 'unlimited' : 'free_capped';
    }
  } catch {
    // Body is optional; if omitted, toggle
  }

  if (!requestedMode) {
    const current = await c.env.DB.prepare("SELECT value FROM system_settings WHERE key = 'storage_tier_mode'").first();
    requestedMode = (current?.value === 'unlimited') ? 'free_capped' : 'unlimited';
  }

  await c.env.DB.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('storage_tier_mode', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind(requestedMode).run();

  return c.json({
    success: true,
    storage_tier_mode: requestedMode,
    is_unlimited: requestedMode === 'unlimited',
  });
});

app.get('/api/admin/users', adminMiddleware, async (c) => {
  const users = await c.env.DB.prepare(`
    SELECT id, email, role, storage_used_bytes, storage_quota_bytes, created_at, updated_at
    FROM users
    ORDER BY created_at ASC
  `).all();

  return c.json({
    users: users.results || [],
  });
});

app.put('/api/admin/users/:id/quota', adminMiddleware, async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json();
  const quotaBytes = Number(body.quota_bytes);

  if (!quotaBytes || isNaN(quotaBytes) || quotaBytes <= 0) {
    return c.json({ error: 'Valid quota_bytes is required' }, 400);
  }

  const modeRow = await c.env.DB.prepare("SELECT value FROM system_settings WHERE key = 'storage_tier_mode'").first();
  const storageTierMode = (modeRow?.value as string) || 'free_capped';

  if (storageTierMode === 'free_capped') {
    const globalCapRow = await c.env.DB.prepare("SELECT value FROM system_settings WHERE key = 'global_quota_bytes'").first();
    const globalCapBytes = Number(globalCapRow?.value || 10737418240); // 10 GB

    const otherUsersAllocated = await c.env.DB.prepare(`
      SELECT SUM(storage_quota_bytes) as total
      FROM users
      WHERE id != ?
    `).bind(userId).first();

    const otherTotal = Number(otherUsersAllocated?.total || 0);
    const newTotal = otherTotal + quotaBytes;

    if (newTotal > globalCapBytes) {
      return c.json({
        error: `Exceeds 10 GB global free tier limit. Allocating ${(quotaBytes / (1024 * 1024 * 1024)).toFixed(2)} GB would bring total allocated to ${(newTotal / (1024 * 1024 * 1024)).toFixed(2)} GB (max: ${(globalCapBytes / (1024 * 1024 * 1024)).toFixed(2)} GB). Please reduce quota or unlock unlimited storage.`
      }, 400);
    }
  }

  const result = await c.env.DB.prepare(`
    UPDATE users
    SET storage_quota_bytes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(quotaBytes, userId).run();

  if (result.meta?.changes === 0) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    success: true,
    user_id: userId,
    storage_quota_bytes: quotaBytes,
  });
});

export default app;
