# Changelog

このプロジェクトのすべての変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に従っています。

## [Unreleased]

### 変更

- ダークモード切り替えの初期化タイミングを調整し、保存済みテーマがある場合でも Hydration Mismatch が発生しないよう修正

## [0.3.1] - 2026-03-04

### 削除

- `public/` 内の未参照 SVG ファイル（file.svg, globe.svg, next.svg, vercel.svg, window.svg）を削除
- `tailwind.config.ts` を削除（Tailwind CSS v4 の CSS ファースト設定に伴い不要）
- `src/app/globals.css` の `@theme inline` ブロックを削除（未使用の Tailwind カラー・フォントトークン定義）
- `src/app/globals.css` の `:root` / `.dark` CSS 変数ブロックを削除し、`body` スタイルを直接カラーコードに変更
