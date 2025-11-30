import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TTSSettings, DEFAULT_TTS_SETTINGS } from '../utils/constants';
import { getTTSSettings, saveTTSSettings } from '../utils/tts';
import { getItem, setItem } from '../utils/storage';
import { setCurrentUserByName } from '../services/supabaseClient';
import { UserName } from '../types/ranking';

interface UserContextValue {
    currentUserName: string;
    ttsSettings: TTSSettings;
    switchUser: (userName: string) => void;
    updateTTSSettings: (settings: TTSSettings) => void;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within UserProvider');
    }
    return context;
};

interface UserProviderProps {
    children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
    const [currentUserName, setCurrentUserName] = useState<string>(() => {
        const userName = getItem<string>('currentUser') || '열음이';
        // 초기 로드 시에도 사용자 ID 설정
        setCurrentUserByName(userName as UserName);
        return userName;
    });

    const [ttsSettings, setTtsSettings] = useState<TTSSettings>(() => {
        return getTTSSettings();
    });

    const switchUser = useCallback((userName: string) => {
        setCurrentUserName(userName);
        setItem('currentUser', userName);
        // Supabase 사용자 ID도 업데이트
        setCurrentUserByName(userName as UserName);
    }, []);

    const updateTTSSettings = useCallback((settings: TTSSettings) => {
        setTtsSettings(settings);
        saveTTSSettings(settings);
    }, []);

    // TTS 설정 변경 감지
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'ttsSettings') {
                setTtsSettings(getTTSSettings());
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const value: UserContextValue = {
        currentUserName,
        ttsSettings,
        switchUser,
        updateTTSSettings,
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
