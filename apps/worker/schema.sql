-- Nulla Cloud Database Schema
-- Optimized for Cloudflare D1 (SQLite Dialect)

PRAGMA foreign_keys = ON;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    salt TEXT NOT NULL,
    server_auth_hash TEXT NOT NULL,
    storage_quota_bytes INTEGER NOT NULL DEFAULT 107374182400, -- 100 GB default
    storage_used_bytes INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Devices & Sessions Table
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('mac', 'web', 'mobile')),
    ip_address TEXT,
    user_agent TEXT,
    last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Encrypted Relational File/Directory Hierarchy
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
    name_encrypted TEXT NOT NULL,
    name_iv TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
    size_bytes INTEGER NOT NULL DEFAULT 0,
    mime_type_encrypted TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading', 'ready', 'deleted')),
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. 4 MB Encrypted Deterministic Block Chunks
CREATE TABLE IF NOT EXISTS node_chunks (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_hash TEXT NOT NULL,
    r2_object_key TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(node_id, chunk_index)
);

-- 5. Upload Sessions
CREATE TABLE IF NOT EXISTS upload_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    total_chunks INTEGER NOT NULL,
    uploaded_chunks INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Public Share Links (/s/:token#key)
CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL DEFAULT 'download' CHECK (permission IN ('view', 'download')),
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Public File Requests / Drop Targets (/r/:token)
CREATE TABLE IF NOT EXISTS file_requests (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_folder_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
    title_encrypted TEXT NOT NULL,
    title_iv TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- High-Performance Query Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_nodes_user_parent ON nodes(user_id, parent_id, status);
CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at ON nodes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_node_chunks_node_id ON node_chunks(node_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_node_chunks_r2_key ON node_chunks(r2_object_key);
CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);
CREATE INDEX IF NOT EXISTS idx_file_requests_token ON file_requests(token);
