# story-snap-next-js-app

SNS向けストーリー（9:16）の画像をブラウザ上で加工するNext.jsアプリです。画像をキャンバスに合わせて配置し、顔または指定した範囲にモザイクをかけてJPEG/PNGで保存できます。

画像の読み込み、顔検出、モザイク処理はブラウザ内で行われます。顔検出にはMediaPipe Tasks Visionを使用し、モデルとWASMランタイムをCDNから読み込みます。

## 主な機能

- 画像を9:16（1080 × 1920px）のキャンバスに自動配置
- JPEG、PNG、WebPの読み込み（10 MB以下、4,000万画素以下）
- MediaPipeによる顔検出と検出範囲への自動モザイク
- キャンバス上のドラッグによる画像位置の調整
- 手動でモザイク範囲を追加
- モザイク対象範囲の個別選択
- モザイク強度（弱・中・強）の切り替え
- JPEGまたはPNGでの保存
- ライトモード／ダークモードの切り替えと設定の保存

## 技術スタック

- **Next.js 16.3.3**（App Router）
- **React 19.2.8**
- **TypeScript 6**
- **Tailwind CSS 4**
- **MediaPipe Tasks Vision 1.0.1**
- **better-sqlite3 13.0.3**
- **Jest 30.5.0**、React Testing Library
- **ESLint 9**

## セットアップ

### 前提条件

- Node.js 20.9以上（CIではNode.js 26.xを使用）
- npm

### インストール

```bash
git clone https://github.com/TakuyaFukumura/story-snap-next-js-app.git
cd story-snap-next-js-app
npm install
```

### 開発サーバー

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

### 本番ビルド

```bash
npm run build
npm start
```

## 使い方

1. 「画像を選択」から画像を読み込みます。
2. 顔検出が完了すると、検出された顔がモザイク対象として選択されます。
3. 必要に応じて画像をドラッグして位置を調整し、対象範囲の選択やモザイク強度を変更します。
4. 「手動で範囲を追加」を有効にすると、キャンバス上をドラッグして範囲を追加できます。
5. 保存形式を選び、「保存」を押して画像をダウンロードします。

顔検出を利用できない場合も、手動でモザイク範囲を追加できます。元画像はサーバーへアップロードされませんが、顔検出に必要なMediaPipeのモデルとWASMファイルは外部CDNから取得します。

## プロジェクト構成

```text
├── lib/
│   └── database.ts                 # SQLite接続とメッセージ取得
├── src/
│   ├── lib/
│   │   └── story-editor.ts         # キャンバス・画像処理の共通ロジック
│   └── app/
│       ├── api/message/route.ts    # メッセージ取得API
│       ├── components/
│       │   ├── DarkModeProvider.tsx
│       │   ├── Header.tsx
│       │   └── StoryEditor.tsx     # 画像編集UI
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── data/app.db                     # API用SQLiteデータベース（初回実行時に生成）
├── __tests__/                       # Jestテスト
├── next.config.ts
├── package.json
└── tsconfig.json
```

## APIとデータベース

`GET /api/message`は、`data/app.db`の`messages`テーブルから最新のメッセージを返します。

```json
{
  "message": "Hello, world."
}
```

データベースと`messages`テーブルはAPIへの初回アクセス時に自動作成されます。画像編集機能はこのデータベースを使用しません。

## 開発用コマンド

```bash
npm run lint          # ESLint
npm test              # Jest
npm run test:watch    # Jest（監視モード）
npm run test:coverage # カバレッジ付きJest
npm run build         # 型チェックを含む本番ビルド
```

## CI/CD

GitHub ActionsのCIはブランチへのプッシュ時に実行され、Node.js 26.x環境で次を確認します。

- `npm ci`
- `npm run lint`
- `npm run build`
- `npm test`

DependabotはGitHub Actionsとnpmパッケージを毎週月曜日09:00（日本時間）に確認し、更新プルリクエストを作成します。

## トラブルシューティング

### 顔検出に失敗する

ネットワーク接続やCDNへのアクセスを確認してください。顔検出に失敗しても、「手動で範囲を追加」から編集を続けられます。

### ポートが使用中

```bash
npm run dev -- --port 3001
```

### データベースを初期化する

APIのメッセージデータを初期状態に戻す場合は、開発サーバーを停止して`data/app.db`を削除し、再度APIへアクセスしてください。
