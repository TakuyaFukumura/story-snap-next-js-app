import {NextResponse} from 'next/server';
import {getMessage} from '../../../../lib/database';

/**
 * メッセージを取得するAPIエンドポイント
 */
export async function GET() {
    try {
        const message = getMessage();
        return NextResponse.json({message});
    } catch (error) {
        console.error('メッセージの取得に失敗しました:', error);
        return NextResponse.json(
            {error: 'メッセージの取得に失敗しました'},
            {status: 500}
        );
    }
}
