# mobile-transpose

## 概要
BOSS RC-505mk2のTRANSPOSEエフェクトを再現したWebアプリケーション。
HTML/CSS/JavaScriptのみで構成された静的サイトです。

## プロジェクト構成
- `index.html` - メインHTMLファイル
- `script.js` - Web Audio APIを使用したJavaScriptロジック
- `style.css` - レスポンシブデザインのスタイル
- `要件定義.txt` - プロジェクトの詳細な要件定義

## 機能
- 16ステップシーケンサーグリッド（4x4）
- Transpose値設定（-12〜+12半音）
- BPM設定（40〜280）
- ベース音設定（音名とオクターブ）
- 再生/ループ再生/停止機能
- Web Audio APIによるブラウザ音源

## 技術スタック
- フロントエンド：HTML5, CSS3, Vanilla JavaScript
- 音源：Web Audio API
- サーバー：Python http.server（開発/本番共通）

## Recent Changes
- 2025-10-03: Replit環境にインポート、デプロイ設定完了
