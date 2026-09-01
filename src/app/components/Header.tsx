'use client';

import {useSyncExternalStore} from 'react';
import {useDarkMode} from './DarkModeProvider';

const emptySubscribe = () => () => {
};

export default function Header() {
    const {theme, setTheme} = useDarkMode();
    const isHydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const displayTheme = isHydrated ? theme : 'light';

    const handleThemeToggle = () => {
        if (theme === 'light') {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    };

    const getThemeIcon = () => {
        if (displayTheme === 'light') {
            return '☀️';
        } else {
            return '🌙';
        }
    };

    const getThemeLabel = () => {
        if (displayTheme === 'light') {
            return 'ライトモード';
        } else {
            return 'ダークモード';
        }
    };

    return (
        <header
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b
            border-gray-200 dark:border-gray-700 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center">
                        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                            basic-next-js-app
                        </h1>
                    </div>

                    <div className="flex items-center">
                        <button
                            onClick={handleThemeToggle}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium
                            text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
                            rounded-lg transition-colors duration-200"
                            title={`現在: ${getThemeLabel()}`}
                        >
                            <span className="text-lg">{getThemeIcon()}</span>
                            <span className="hidden sm:inline">{getThemeLabel()}</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
