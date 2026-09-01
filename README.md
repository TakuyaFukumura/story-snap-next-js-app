# basic-next-js-app

Next.jsを使ったシンプルな「Hello, world.」アプリケーションです。
このプロジェクトは、SQLiteデータベースからメッセージを取得して表示する基本的な機能を提供します。

## 技術スタック

- **Next.js 16.1.6** - React フレームワーク（App Routerを使用）
- **React 19.2.4** - ユーザーインターフェース構築
- **TypeScript** - 型安全性
- **Tailwind CSS 4** - スタイリング
- **SQLite** - データベース（better-sqlite3）
- **ESLint** - コード品質管理

## 機能

- SQLiteデータベースから「Hello, world.」メッセージを取得
- レスポンシブデザイン対応
- ダークモード対応（手動切替機能付き）
    - ライトモードとダークモードの2つのモードを手動で切り替え可能
    - ユーザーの選択はローカルストレージに保存され、ページ再読み込み時も維持されます
- TypeScriptによる型安全性
- モダンなUI/UXデザイン

## 始め方

### 前提条件

- Node.js 20.x以上
- npm、yarn、またはpnpm

### インストール

1. リポジトリをクローン：
    ```bash
    git clone https://github.com/TakuyaFukumura/basic-next-js-app.git
    ```
    ```bash
    cd basic-next-js-app
    ```

2. 依存関係をインストール：
    ```bash
    npm install
    ```
   または
    ```bash
    yarn install
    ```
   または
    ```bash
    pnpm install
    ```

### 開発サーバーの起動

```bash
npm run dev
```

または

```bash
yarn dev
```

または

```bash
pnpm dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて
アプリケーションを確認してください。

### ビルドと本番デプロイ

本番用にアプリケーションをビルドする：

```bash
npm run build
```

```bash
npm start
```

または

```bash
yarn build
```

```bash
yarn start
```

または

```bash
pnpm build
```

```bash
pnpm start
```

## プロジェクト構造

```
├── lib/
│   └── database.ts          # SQLiteデータベース接続・操作
├── src/
│   └── app/
│       ├── api/
│       │   └── message/
│       │       └── route.ts # APIエンドポイント
│       ├── components/      # Reactコンポーネント
│       │   ├── DarkModeProvider.tsx  # ダークモードProvider
│       │   └── Header.tsx   # ヘッダーコンポーネント
│       ├── globals.css      # グローバルスタイル
│       ├── layout.tsx       # アプリケーションレイアウト
│       └── page.tsx         # メインページコンポーネント
├── data/                    # SQLiteデータベースファイル（自動生成）
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## API エンドポイント

### GET /api/message

データベースから最新のメッセージを取得します。

**レスポンス:**

```json
{
  "message": "Hello, world."
}
```

## データベース

SQLiteデータベースは初回起動時に自動的に作成されます：

- データベースファイル: `data/app.db`
- テーブル: `messages`
    - `id`: 自動増分プライマリーキー
    - `content`: メッセージ内容
    - `created_at`: 作成日時

## カスタマイズ

### メッセージの変更

データベース内のメッセージを変更したい場合は、
SQLiteクライアントを使用して `data/app.db` ファイル内の `messages` テーブルを編集してください。

### スタイルの変更

スタイルは Tailwind CSS を使用しています。
`src/app/page.tsx` ファイル内のクラス名を変更することで、外観をカスタマイズできます。

## 開発

### テスト

このプロジェクトはJestを使用したテストが設定されています。

#### テストの実行

```bash
npm test
```

または

```bash
yarn test
```

または

```bash
pnpm test
```

#### テストの監視モード

```bash
npm run test:watch
```

#### カバレッジレポートの生成

```bash
npm run test:coverage
```

#### テストファイルの構成

- `__tests__/lib/database.test.ts`: データベース機能のテスト
- `__tests__/src/app/components/DarkModeProvider.test.tsx`: ダークモードProvider のテスト
- `__tests__/src/app/components/Header.test.tsx`: ヘッダーコンポーネントのテスト

#### テストの特徴

- **データベーステスト**: SQLiteを使用した実際のデータベース操作のテスト
- **Reactコンポーネントテスト**: React Testing Library を使用したコンポーネントのレンダリングとインタラクションのテスト
- **モッキング**: localStorage や外部依存関係のモック
- **カバレッジ**: コードカバレッジの測定と報告

### リンティング

```bash
npm run lint
```

または

```bash
yarn lint
```

または

```bash
pnpm lint
```

### 型チェック

TypeScriptの型チェックは、ビルド時またはIDEで自動的に実行されます。

## CI/CD

このプロジェクトはGitHub Actionsを使用した継続的インテグレーション（CI）を設定しています。

### 自動テスト

以下の条件でCIが実行されます：

- `main`ブランチへのプッシュ時
- プルリクエストの作成・更新時

CIでは以下のチェックが行われます：

- ESLintによる静的解析
- TypeScriptの型チェック
- Jestを使用したユニットテストとインテグレーションテスト
- アプリケーションのビルド検証
- Node.js 20.x での動作確認

## 自動依存関係更新（Dependabot）

このプロジェクトでは、依存関係の安全性と最新化のために[Dependabot](https://docs.github.com/ja/code-security/dependabot)
を利用しています。

- GitHub Actionsおよびnpmパッケージの依存関係は**月次（月曜日 09:00 JST）**で自動チェック・更新されます。
- 更新内容は自動でプルリクエストとして作成されます。
- 詳細な設定は `.github/dependabot.yml` を参照してください。

## トラブルシューティング

### データベース関連のエラー

- `data/` フォルダが存在しない場合、自動的に作成されます
- データベースファイルが破損した場合は、`data/app.db` を削除して再起動してください

### ポート競合

デフォルトのポート3000が使用中の場合：

```bash
npm run dev -- --port 3001
```
