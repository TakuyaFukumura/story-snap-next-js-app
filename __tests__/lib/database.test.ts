/**
 * データベース機能のテスト
 *
 * このテストファイルは、lib/database.tsの機能をテストします。
 * テストでは実際のファイルシステムを使用しますが、テスト専用のディレクトリを作成します。
 */

import fs from 'fs';
import path from 'path';

// テスト専用のデータディレクトリ・DBパス
const testDataDir = path.join(__dirname, 'test-data');
const testDbPath = path.join(testDataDir, 'test-app.db');

// テスト用ディレクトリ・ファイル操作関数
function setupTestDir() {
    if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, {recursive: true});
    }
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
}

function cleanupTestDir() {
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, {recursive: true, force: true});
    }
}

// pathモジュールのjoinのみモック
jest.mock('path', () => ({
    ...jest.requireActual('path'),
    join: (...args: string[]): string => {
        if (args[1] === 'data' && args[2] === 'app.db') {
            return testDbPath;
        }
        return jest.requireActual('path').join(...args);
    },
}));

describe('Database Functions', () => {
    // 各テスト前の準備
    beforeEach(() => {
        setupTestDir();
        // モジュールキャッシュをリセットして、各テストで新しいインスタンスを作成
        jest.resetModules();
    });

    // 各テスト後のクリーンアップ
    afterEach(async () => {
        // データベース接続をクローズ
        try {
            const {getDatabase} = await import('../../lib/database');
            const db = getDatabase();
            if (db && db.close) db.close();
        } catch {
        }

        cleanupTestDir();
    });

    describe('getDatabase', () => {
        it('新しいデータベース接続を作成する', async () => {
            const {getDatabase} = await import('../../lib/database');
            const db = getDatabase();

            expect(db).toBeDefined();
            expect(db.open).toBe(true);
        });

        it('messagesテーブルを作成する', async () => {
            const {getDatabase} = await import('../../lib/database');
            const db = getDatabase();

            // テーブルの存在を確認
            const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get();
            expect(tableInfo).toBeDefined();
            expect(tableInfo).toHaveProperty('name', 'messages');
        });

        it('初期データを挿入する', async () => {
            const {getDatabase} = await import('../../lib/database');
            const db = getDatabase();

            // 初期データの存在を確認
            const count = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
            expect(count.count).toBe(1);

            const message = db.prepare('SELECT content FROM messages').get() as { content: string };
            expect(message.content).toBe('Hello, world.');
        });

        it('既存のデータベース接続を再利用する', async () => {
            const {getDatabase} = await import('../../lib/database');
            const db1 = getDatabase();
            const db2 = getDatabase();

            expect(db1).toBe(db2);
        });

        it('データベーステーブルの構造を確認する', async () => {
            const {getDatabase} = await import('../../lib/database');
            const db = getDatabase();

            // テーブル構造を確認
            interface ColumnInfo {
                name: string;
                type: string;
                notnull: number;
                dflt_value: string | null;
                pk: number;
            }

            const tableInfo = db.prepare("PRAGMA table_info(messages)").all() as ColumnInfo[];

            expect(tableInfo).toHaveLength(3);
            expect(tableInfo.find((col) => col.name === 'id')).toBeDefined();
            expect(tableInfo.find((col) => col.name === 'content')).toBeDefined();
            expect(tableInfo.find((col) => col.name === 'created_at')).toBeDefined();
        });
    });

    describe('getMessage', () => {
        it('デフォルトメッセージを取得する', async () => {
            const {getMessage} = await import('../../lib/database');

            const message = getMessage();
            expect(message).toBe('Hello, world.');
        });

        it('メッセージが存在しない場合はデフォルトメッセージを返す', async () => {
            const {getDatabase, getMessage} = await import('../../lib/database');
            const db = getDatabase();

            // 全てのメッセージを削除
            db.prepare('DELETE FROM messages').run();

            const message = getMessage();
            expect(message).toBe('Hello, world.');
        });
    });

    describe('Database Integration', () => {
        it('複数のメッセージから最新のものを取得する', async () => {
            const {getDatabase, getMessage} = await import('../../lib/database');
            const db = getDatabase();

            // 複数のメッセージを追加（時間間隔を設けるため少し待機）
            db.prepare('INSERT INTO messages (content) VALUES (?)').run('First message');

            // SQLiteの精度の関係で、わずかに時間をずらす
            const now = new Date().toISOString();
            db.prepare('INSERT INTO messages (content, created_at) VALUES (?, ?)').run('Latest message', now);

            const message = getMessage();
            expect(message).toBe('Latest message');
        });

        it('データベースファイルが存在することを確認する', async () => {
            const {getDatabase} = await import('../../lib/database');
            getDatabase();

            expect(fs.existsSync(testDbPath)).toBe(true);
        });

        it('データベースへの基本的なCRUD操作', async () => {
            const {getDatabase} = await import('../../lib/database');
            const db = getDatabase();

            // Create: メッセージを追加
            const insertResult = db.prepare('INSERT INTO messages (content) VALUES (?)').run('CRUD Test Message');
            expect(insertResult.changes).toBe(1);

            // Read: メッセージを読み取り
            const readResult = db.prepare('SELECT content FROM messages WHERE content = ?').get('CRUD Test Message') as {
                content: string
            };
            expect(readResult).toBeDefined();
            expect(readResult.content).toBe('CRUD Test Message');

            // Update: メッセージを更新
            const updateResult = db.prepare('UPDATE messages SET content = ? WHERE content = ?').run('Updated CRUD Message', 'CRUD Test Message');
            expect(updateResult.changes).toBe(1);

            // Delete: メッセージを削除
            const deleteResult = db.prepare('DELETE FROM messages WHERE content = ?').run('Updated CRUD Message');
            expect(deleteResult.changes).toBe(1);
        });
    });
});
