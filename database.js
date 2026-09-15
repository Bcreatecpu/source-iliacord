import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';

// A configured remote database is authoritative. Never fall back to local storage
// on a connection error: that would make accepted writes disappear after restart.
export function openDatabase() {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    if (!/^(libsql|https):\/\//.test(url) || !process.env.TURSO_AUTH_TOKEN) {
      throw new Error('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no servidor.');
    }
    const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    return {
      execute: (sql, args = []) => client.execute({ sql, args }),
      executeMultiple: sql => client.executeMultiple(sql),
      close: () => client.close(),
    };
  }
  if (process.env.REQUIRE_REMOTE_DB === 'true') {
    throw new Error('Banco remoto obrigatório: configure as variáveis TURSO antes de publicar.');
  }
  mkdirSync(process.env.DATA_DIR || 'data', { recursive: true });
  const local = new DatabaseSync(`${process.env.DATA_DIR || 'data'}/iliacord.sqlite`);
  local.exec('PRAGMA journal_mode=WAL;');
  return {
    async execute(sql, args = []) {
      const stmt = local.prepare(sql);
      if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql)) return { rows: stmt.all(...args) };
      return { rows: [], ...stmt.run(...args) };
    },
    async executeMultiple(sql) { local.exec(sql); },
    close: () => local.close(),
  };
}
