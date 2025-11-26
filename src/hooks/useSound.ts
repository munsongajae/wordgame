import { useCallback } from 'react';
import { playCorrectSound, playWrongSound, playRecordSound, playTimerSound } from '../utils/sound';

/**
 * 사운드 재생 Hook
 */
export const useSound = () => {
    const playCorrect = useCallback(() => {
        playCorrectSound();
    }, []);

    const playWrong = useCallback(() => {
        playWrongSound();
    }, []);

    const playRecord = useCallback(() => {
        playRecordSound();
    }, []);

    const playTimer = useCallback(() => {
        playTimerSound();
    }, []);

    return {
        playCorrect,
        playWrong,
        playRecord,
        playTimer,
    };
};
