import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Word } from '../types/word';
import { GoogleSheetsService } from '../services/googleSheetsService';

interface CacheInfo {
    timestamp: number;
    count: number;
}

interface WordsContextValue {
    words: Word[];
    allWords: Word[];
    selectedCategories: string[];
    isLoading: boolean;
    error: string | null;
    cacheInfo: CacheInfo | null;
    refreshWords: (forceRefresh?: boolean) => Promise<void>;
    setSelectedCategories: (categories: string[]) => void;
}

const WordsContext = createContext<WordsContextValue | undefined>(undefined);

export const useWords = () => {
    const context = useContext(WordsContext);
    if (!context) {
        throw new Error('useWords must be used within WordsProvider');
    }
    return context;
};

interface WordsProviderProps {
    children: ReactNode;
}

export const WordsProvider: React.FC<WordsProviderProps> = ({ children }) => {
    const [words, setWords] = useState<Word[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);

    const refreshWords = useCallback(async (forceRefresh: boolean = false) => {
        setIsLoading(true);
        setError(null);

        try {
            const fetchedWords = await GoogleSheetsService.fetchWordsWithCache(forceRefresh);

            if (fetchedWords.length === 0) {
                setError('단어 데이터를 불러올 수 없습니다. 구글 시트 설정을 확인하세요.');
            }

            setWords(fetchedWords);

            // 캐시 정보 업데이트
            const cachedWords = GoogleSheetsService.getWordsFromCache();
            if (cachedWords) {
                const cacheTimestamp = localStorage.getItem('wordsCacheTimestamp');
                if (cacheTimestamp) {
                    setCacheInfo({
                        timestamp: parseInt(cacheTimestamp, 10),
                        count: cachedWords.length,
                    });
                }
            }
        } catch (err) {
            console.error('Failed to load words:', err);
            setError('단어를 불러오는데 실패했습니다.');
            setWords([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 초기 로드
    useEffect(() => {
        refreshWords();
    }, [refreshWords]);

    const filteredWords = React.useMemo(() => {
        if (selectedCategories.includes('all') || selectedCategories.length === 0) {
            return words;
        }
        return words.filter(word => word.category && selectedCategories.includes(word.category));
    }, [words, selectedCategories]);

    const value: WordsContextValue = {
        words: filteredWords,
        allWords: words,
        selectedCategories,
        isLoading,
        error,
        cacheInfo,
        refreshWords,
        setSelectedCategories,
    };

    return <WordsContext.Provider value={value}>{children}</WordsContext.Provider>;
};
