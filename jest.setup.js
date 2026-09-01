// Jest用のセットアップファイル
import '@testing-library/jest-dom'
import {TextDecoder, TextEncoder} from 'util'

// mock用のグローバル設定
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// localStorageのモック
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
}
global.localStorage = localStorageMock

// fetchのモック（テスト時に必要に応じて使用）
global.fetch = jest.fn()
