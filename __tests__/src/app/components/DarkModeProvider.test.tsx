/**
 * DarkModeProvider コンポーネントのテスト
 *
 * このテストファイルは、src/app/components/DarkModeProvider.tsxの機能をテストします。
 * React Context、localStorage、テーマの切り替え機能をテストしています。
 */

import React from 'react';
import {act, render, renderHook, screen} from '@testing-library/react';
import {DarkModeProvider, useDarkMode} from '@/app/components/DarkModeProvider';

// localStorageをモック
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

// 各テスト前にlocalStorageを初期化
beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
    });
});

describe('DarkModeProvider', () => {
    const TestComponent = () => {
        const {theme, setTheme, isDark} = useDarkMode();

        return (
            <div>
                <span data-testid="theme">{theme}</span>
                <span data-testid="isDark">{isDark.toString()}</span>
                <button data-testid="set-light" onClick={() => setTheme('light')}>
                    ライトモード
                </button>
                <button data-testid="set-dark" onClick={() => setTheme('dark')}>
                    ダークモード
                </button>
            </div>
        );
    };

    const renderWithProvider = (children: React.ReactNode) => {
        return render(
            <DarkModeProvider>
                {children}
            </DarkModeProvider>
        );
    };

    describe('初期状態', () => {
        it('デフォルトでライトモードが設定される', () => {
            renderWithProvider(<TestComponent/>);

            expect(screen.getByTestId('theme')).toHaveTextContent('light');
            expect(screen.getByTestId('isDark')).toHaveTextContent('false');
        });

        it('localStorageに保存されたテーマを読み込む', () => {
            localStorageMock.getItem.mockReturnValue('dark');

            renderWithProvider(<TestComponent/>);

            expect(screen.getByTestId('theme')).toHaveTextContent('dark');
            expect(screen.getByTestId('isDark')).toHaveTextContent('true');
        });

        it('無効なlocalStorageの値は無視される', () => {
            localStorageMock.getItem.mockReturnValue('invalid-theme');

            renderWithProvider(<TestComponent/>);

            expect(screen.getByTestId('theme')).toHaveTextContent('light');
            expect(screen.getByTestId('isDark')).toHaveTextContent('false');
        });
    });

    describe('テーマの切り替え', () => {
        it('ライトモードからダークモードに切り替える', () => {
            renderWithProvider(<TestComponent/>);

            // 初期状態の確認
            expect(screen.getByTestId('theme')).toHaveTextContent('light');

            // ダークモードに切り替え
            act(() => {
                screen.getByTestId('set-dark').click();
            });

            expect(screen.getByTestId('theme')).toHaveTextContent('dark');
            expect(screen.getByTestId('isDark')).toHaveTextContent('true');
            expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
        });

        it('ダークモードからライトモードに切り替える', () => {
            localStorageMock.getItem.mockReturnValue('dark');

            renderWithProvider(<TestComponent/>);

            // 初期状態の確認
            expect(screen.getByTestId('theme')).toHaveTextContent('dark');

            // ライトモードに切り替え
            act(() => {
                screen.getByTestId('set-light').click();
            });

            expect(screen.getByTestId('theme')).toHaveTextContent('light');
            expect(screen.getByTestId('isDark')).toHaveTextContent('false');
            expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
        });
    });

    // テーマ変更操作を関数化
    const setThemeByTestId = (mode: 'light' | 'dark') => {
        act(() => {
            screen.getByTestId(`set-${mode}`).click();
        });
    };

    describe('localStorage連携', () => {
        it('テーマ変更時にlocalStorageへ正しく保存される', () => {
            renderWithProvider(<TestComponent/>);

            setThemeByTestId('dark');
            setThemeByTestId('light');
            setThemeByTestId('dark');

            expect(localStorageMock.setItem).toHaveBeenCalledTimes(3);
            expect(localStorageMock.setItem).toHaveBeenNthCalledWith(1, 'theme', 'dark');
            expect(localStorageMock.setItem).toHaveBeenNthCalledWith(2, 'theme', 'light');
            expect(localStorageMock.setItem).toHaveBeenNthCalledWith(3, 'theme', 'dark');
        });
    });

    describe('useDarkMode フック', () => {
        it('Provider外で使用するとエラーが発生する', () => {
            // エラーログを抑制
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            expect(() => {
                renderHook(() => useDarkMode());
            }).toThrow('useDarkMode must be used within a DarkModeProvider');

            consoleSpy.mockRestore();
        });

        it('Provider内で使用すると正しく動作する', () => {
            // localStorageをクリアして確実にライトモードから開始
            localStorageMock.clear();
            localStorageMock.getItem.mockReturnValue(null);

            const wrapper = ({children}: { children: React.ReactNode }) => (
                <DarkModeProvider>{children}</DarkModeProvider>
            );

            const {result} = renderHook(() => useDarkMode(), {wrapper});

            expect(result.current.theme).toBe('light');
            expect(result.current.isDark).toBe(false);
            expect(typeof result.current.setTheme).toBe('function');
        });
    });

    describe('子コンポーネントのレンダリング', () => {
        it('子コンポーネントが正常にレンダリングされる', () => {
            renderWithProvider(
                <div data-testid="child-component">子コンポーネント</div>
            );

            expect(screen.getByTestId('child-component')).toBeInTheDocument();
        });

        it('複数の子コンポーネントが正常にレンダリングされる', () => {
            renderWithProvider(
                <>
                    <div data-testid="child-1">子コンポーネント1</div>
                    <div data-testid="child-2">子コンポーネント2</div>
                </>
            );

            expect(screen.getByTestId('child-1')).toBeInTheDocument();
            expect(screen.getByTestId('child-2')).toBeInTheDocument();
        });
    });
});
