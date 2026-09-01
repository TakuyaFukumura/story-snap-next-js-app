/**
 * Header コンポーネントのテスト
 *
 * このテストファイルは、src/app/components/Header.tsxの機能をテストします。
 * ダークモード/ライトモードの切り替えボタンとヘッダーの表示をテストしています。
 */

import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {hydrateRoot, type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {DarkModeProvider} from '@/app/components/DarkModeProvider';
import Header from '../../../../src/app/components/Header';
import '@testing-library/jest-dom';

describe('Header', () => {
    let getItemSpy: jest.SpyInstance;

    beforeEach(() => {
        getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        });
        document.documentElement.classList.remove('dark');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.documentElement.classList.remove('dark');
    });

    const renderWithProvider = (initialTheme?: 'light' | 'dark') => {
        if (initialTheme) {
            getItemSpy.mockReturnValue(initialTheme);
        }

        return render(
            <DarkModeProvider>
                <Header/>
            </DarkModeProvider>
        );
    };

    describe('基本的なレンダリング', () => {
        it('ヘッダータイトルが表示される', () => {
            renderWithProvider();

            expect(screen.getByText('story-snap')).toBeInTheDocument();
        });

        it('ヘッダーのHTML構造が正しい', () => {
            renderWithProvider();

            const header = screen.getByRole('banner');
            expect(header).toBeInTheDocument();
            expect(header.tagName).toBe('HEADER');
        });

        it('テーマ切り替えボタンが表示される', () => {
            renderWithProvider();

            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();
        });
    });

    describe('ライトモード', () => {
        it('ライトモード時に太陽アイコンが表示される', () => {
            renderWithProvider('light');

            expect(screen.getByText('☀️')).toBeInTheDocument();
        });

        it('ライトモード時のラベルが表示される', () => {
            renderWithProvider('light');

            expect(screen.getByText('ライトモード')).toBeInTheDocument();
        });

        it('ボタンのtitle属性が正しく設定される', () => {
            renderWithProvider('light');

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('title', '現在: ライトモード');
        });
    });

    describe('ダークモード', () => {
        it('ダークモード時に月アイコンが表示される', async () => {
            renderWithProvider('dark');

            expect(await screen.findByText('🌙')).toBeInTheDocument();
        });

        it('ダークモード時のラベルが表示される', async () => {
            renderWithProvider('dark');

            expect(await screen.findByText('ダークモード')).toBeInTheDocument();
        });

        it('ボタンのtitle属性が正しく設定される', async () => {
            renderWithProvider('dark');

            const button = screen.getByRole('button');
            await waitFor(() => {
                expect(button).toHaveAttribute('title', '現在: ダークモード');
            });
        });
    });

    describe('Hydration Mismatch 対策', () => {
        it('保存済みテーマが異なっても hydration warning を出さない', async () => {
            getItemSpy.mockReturnValue('light');

            const serverHtml = renderToString(
                <DarkModeProvider>
                    <Header/>
                </DarkModeProvider>
            );

            getItemSpy.mockReturnValue('dark');

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const container = document.createElement('div');
            container.innerHTML = serverHtml;
            document.body.appendChild(container);

            let root: Root | undefined;

            try {
                await act(async () => {
                    root = hydrateRoot(
                        container,
                        <DarkModeProvider>
                            <Header/>
                        </DarkModeProvider>
                    );
                });

                await waitFor(() => {
                    expect(within(container).getByText('ダークモード')).toBeInTheDocument();
                });

                expect(
                    consoleErrorSpy.mock.calls.some((call) => call.some((arg) => String(arg).includes('Hydration failed')))
                ).toBe(false);
            } finally {
                root?.unmount();
                container.remove();
                consoleErrorSpy.mockRestore();
            }
        });
    });

    describe('テーマ切り替え機能', () => {
        it('ライトモードからダークモードに切り替わる', () => {
            renderWithProvider('light');

            // 初期状態の確認
            expect(screen.getByText('☀️')).toBeInTheDocument();
            expect(screen.getByText('ライトモード')).toBeInTheDocument();

            // ボタンをクリック
            const button = screen.getByRole('button');
            fireEvent.click(button);

            // ダークモードに変更されたことを確認
            expect(screen.getByText('🌙')).toBeInTheDocument();
            expect(screen.getByText('ダークモード')).toBeInTheDocument();
        });

        it('ダークモードからライトモードに切り替わる', () => {
            renderWithProvider('dark');

            // 初期状態の確認
            expect(screen.getByText('🌙')).toBeInTheDocument();
            expect(screen.getByText('ダークモード')).toBeInTheDocument();

            // ボタンをクリック
            const button = screen.getByRole('button');
            fireEvent.click(button);

            // ライトモードに変更されたことを確認
            expect(screen.getByText('☀️')).toBeInTheDocument();
            expect(screen.getByText('ライトモード')).toBeInTheDocument();
        });

        it('複数回のクリックで正しく切り替わる', () => {
            renderWithProvider('light');

            const button = screen.getByRole('button');

            // ライトモード → ダークモード
            fireEvent.click(button);
            expect(screen.getByText('🌙')).toBeInTheDocument();

            // ダークモード → ライトモード
            fireEvent.click(button);
            expect(screen.getByText('☀️')).toBeInTheDocument();

            // ライトモード → ダークモード
            fireEvent.click(button);
            expect(screen.getByText('🌙')).toBeInTheDocument();
        });
    });

    describe('ボタンのアクセシビリティ', () => {
        it('ボタンがキーボードでアクセス可能', () => {
            renderWithProvider();

            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();

            // タブキーでフォーカス可能かを確認
            button.focus();
            expect(button).toHaveFocus();
        });

        it('適切なaria属性が設定されている', () => {
            renderWithProvider();

            const button = screen.getByRole('button');

            // title属性による説明があることを確認
            expect(button).toHaveAttribute('title');
            expect(button.getAttribute('title')).toContain('現在:');
        });
    });

    describe('レスポンシブデザイン', () => {
        beforeEach(() => {
            renderWithProvider('light');
        });

        it('テキストラベルが適切なクラスで制御されている', () => {
            // 'hidden sm:inline' クラスでモバイルでは非表示になることを想定
            const textLabel = screen.getByText('ライトモード');
            expect(textLabel).toHaveClass('hidden', 'sm:inline');
        });

        it('アイコンが常に表示される', () => {

            const icon = screen.getByText('☀️');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('CSS クラスの適用', () => {
        it('ヘッダーに適切なスタイルクラスが適用される', () => {
            renderWithProvider();

            const header = screen.getByRole('banner');
            expect(header).toHaveClass('bg-white/80', 'dark:bg-gray-800/80');
        });

        it('ボタンに適切なスタイルクラスが適用される', () => {
            renderWithProvider();

            const button = screen.getByRole('button');
            expect(button).toHaveClass('flex', 'items-center', 'gap-2');
        });
    });
});
