import { useState, useCallback } from 'react';
import { logAttempt, saveSession, updateProgress } from '../services/trackingService';
import { QuizMode } from '../utils/constants';

/**
 * 세션 트래킹 Hook
 */
export const useTracking = (mode: QuizMode) => {
    const [sessionId, setSessionId] = useState<string | null>(null);

    const logAnswer = useCallback((wordId: string, correct: boolean) => {
        try {
            logAttempt({
                sessionId,
                mode,
                wordId,
                correct,
            });
        } catch (error) {
            console.error('답안 로깅 실패:', error);
        }
    }, [sessionId, mode]);

    const updateWordProgress = useCallback((wordId: string, correct: boolean) => {
        try {
            updateProgress({
                wordId,
                correct,
            });
        } catch (error) {
            console.error('단어 진행도 업데이트 실패:', error);
        }
    }, []);

    const saveQuizSession = useCallback(async (
        score: number,
        total: number,
        durationSec: number
    ) => {
        try {
            console.log('세션 저장:', { mode, score, total, durationSec });
            const id = await saveSession({
                mode,
                score,
                total,
                durationSec,
            });
            setSessionId(id);
            return id;
        } catch (error) {
            console.error('세션 저장 실패:', error);
            return null;
        }
    }, [mode]);

    return {
        sessionId,
        logAnswer,
        updateWordProgress,
        saveQuizSession,
    };
};
