'use client';

import {useEffect, useState} from 'react';

export default function Home() {
    const [message, setMessage] = useState<string>('読み込み中...');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMessage = async () => {
            try {
                const response = await fetch('/api/message');
                if (!response.ok) {
                    throw new Error('メッセージの取得に失敗しました');
                }
                const data = await response.json();
                setMessage(data.message);
            } catch (err) {
                setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
            } finally {
                setLoading(false);
            }
        };

        fetchMessage();
    }, []);

    let content;
    if (loading) {
        content = (
            <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">読み込み中...</span>
            </div>
        );
    } else if (error) {
        content = (
            <div className="text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                エラー: {error}
            </div>
        );
    } else {
        content = (
            <div
                className="text-2xl font-semibold text-blue-600 dark:text-blue-400 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-700">
                {message}
            </div>
        );
    }

    return (
        <div
            className="font-sans flex items-center justify-center min-h-[calc(100vh-4rem)] bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <main className="text-center p-8">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 max-w-md mx-auto">
                    <h1 className="text-4xl font-bold mb-8 text-gray-800 dark:text-gray-200">
                        basic-next-js-app
                    </h1>

                    <div className="mb-8">
                        {content}
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        このメッセージはSQLiteデータベースから取得されています
                    </p>

                    <div className="text-xs text-gray-400 dark:text-gray-500">
                        Next.js + TypeScript + Tailwind CSS + SQLite
                    </div>
                </div>
            </main>
        </div>
    );
}
