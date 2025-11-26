import { useState, useCallback, useRef, useEffect } from 'react';

interface QuizStateOptions<T> {
    questions: T[];
    onFinish?: (score: number) => void;
}

/**
 * 퀴즈 상태 관리 Hook
 */
export const useQuizState = <T,>(options: QuizStateOptions<T>) => {
    const { questions, onFinish } = options;

    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [score, setScore] = useState(0);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [finished, setFinished] = useState(false);
    const [wrongItems, setWrongItems] = useState<T[]>([]);

    const scoreRef = useRef(0);

    // score를 ref에도 동기화
    useEffect(() => {
        scoreRef.current = score;
    }, [score]);

    const currentQuestion = questions[index] || null;
    const totalQuestions = questions.length;
    const progress = totalQuestions > 0 ? ((index + 1) / totalQuestions) * 100 : 0;

    const incrementScore = useCallback(() => {
        setScore(s => s + 1);
    }, []);

    const selectOption = useCallback((optionIndex: number) => {
        if (selected !== null || isCorrect !== null) return;
        setSelected(optionIndex);
    }, [selected, isCorrect]);

    const checkAnswer = useCallback((correct: boolean) => {
        setIsCorrect(correct);
        if (correct) {
            incrementScore();
        }
    }, [incrementScore]);

    const markWrong = useCallback((item: T) => {
        setWrongItems(prev => {
            // 중복 방지
            if (prev.some(i => i === item)) return prev;
            return [...prev, item];
        });
    }, []);

    const nextQuestion = useCallback(() => {
        if (index + 1 >= totalQuestions) {
            setFinished(true);
            if (onFinish) {
                onFinish(scoreRef.current);
            }
            return;
        }

        setIndex(i => i + 1);
        setSelected(null);
        setIsCorrect(null);
    }, [index, totalQuestions, onFinish]);

    const reset = useCallback(() => {
        setIndex(0);
        setSelected(null);
        setScore(0);
        setIsCorrect(null);
        setFinished(false);
        setWrongItems([]);
    }, []);

    return {
        // 상태
        index,
        selected,
        score,
        isCorrect,
        finished,
        wrongItems,
        currentQuestion,
        totalQuestions,
        progress,
        scoreRef, // 비동기 작업에서 최신 점수 참조용

        // 액션
        incrementScore,
        selectOption,
        checkAnswer,
        markWrong,
        nextQuestion,
        reset,
    };
};
