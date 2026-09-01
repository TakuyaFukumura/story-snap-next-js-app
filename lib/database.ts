import Database from 'better-sqlite3';
import {join} from 'path';
import fs from 'fs';

// データベースファイルのパス
const dbPath = join(process.cwd(), 'data', 'app.db');

// データベースインスタンス
let db: Database.Database | null = null;

/**
 * データベース接続を取得する
 */
export function getDatabase(): Database.Database {
    if (!db) {
        // データベースディレクトリが存在しない場合は作成
        const dataDir = join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, {recursive: true});
        }

        db = new Database(dbPath);

        // テーブルが存在しない場合は作成
        db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // 初期データが存在しない場合は挿入
        const count = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
        if (count.count === 0) {
            db.prepare('INSERT INTO messages (content) VALUES (?)').run('Hello, world.');
        }
    }

    return db;
}

/**
 * メッセージを取得する
 */
export function getMessage(): string {
    const database = getDatabase();
    const result = database.prepare('SELECT content FROM messages ORDER BY created_at DESC LIMIT 1').get() as {
        content: string
    } | undefined;
    return result?.content || 'Hello, world.';
}
