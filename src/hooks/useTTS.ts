import { useCallback, useState, useEffect } from 'react';
import { speakText, stopSpeaking, getTTSSettings, saveTTSSettings } from '../utils/tts';
import { TTSSettings } from '../utils/constants';

/**
 * TTS(음성 합성) Hook
 */
export const useTTS = () => {
    const [settings, setSettings] = useState<TTSSettings>(getTTSSettings());

    // 설정 변경 시 localStorage에 저장
    useEffect(() => {
        saveTTSSettings(settings);
    }, [settings]);

    const speak = useCallback(async (text: string, customSettings?: Partial<TTSSettings>) => {
        await speakText(text, customSettings);
    }, []);

    const stop = useCallback(() => {
        stopSpeaking();
    }, []);

    const updateSettings = useCallback((newSettings: Partial<TTSSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    return {
        speak,
        stop,
        settings,
        updateSettings,
    };
};
