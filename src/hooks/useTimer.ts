import { useState, useEffect, useRef, useCallback } from 'react';
import { QUIZ_CONSTANTS } from '../utils/constants';

interface TimerOptions {
    onExpire?: () => void;
    onThreeSeconds?: () => void;
    duration?: number;
}

/**
 * 타이머 Hook
 */
export const useTimer = (options: TimerOptions = {}) => {
    const {
        onExpire,
        onThreeSeconds,
        duration = QUIZ_CONSTANTS.TIMER_DURATION
    } = options;

    const [timeLeft, setTimeLeft] = useState(duration);
    const [isPaused, setIsPaused] = useState(false);
    const onExpireRef = useRef(onExpire);
    const onThreeSecondsRef = useRef(onThreeSeconds);
    const hasCalledThreeSecondsRef = useRef(false);

    // 콜백 refs 업데이트
    useEffect(() => {
        onExpireRef.current = onExpire;
        onThreeSecondsRef.current = onThreeSeconds;
    }, [onExpire, onThreeSeconds]);

    // 타이머 로직
    useEffect(() => {
        if (isPaused) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    if (onExpireRef.current) {
                        onExpireRef.current();
                    }
                    return 0;
                }

                const nextValue = prev - 1;

                // 3초에 도달했을 때 한 번만 콜백 호출
                if (nextValue === 3 && !hasCalledThreeSecondsRef.current && onThreeSecondsRef.current) {
                    hasCalledThreeSecondsRef.current = true;
                    onThreeSecondsRef.current();
                }

                return nextValue;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isPaused]);

    const reset = useCallback((newDuration?: number) => {
        setTimeLeft(newDuration ?? duration);
        setIsPaused(false);
        hasCalledThreeSecondsRef.current = false;
    }, [duration]);

    const pause = useCallback(() => {
        setIsPaused(true);
    }, []);

    const resume = useCallback(() => {
        setIsPaused(false);
    }, []);

    return {
        timeLeft,
        isExpired: timeLeft === 0,
        isPaused,
        reset,
        pause,
        resume,
    };
};
