import { SOUND_PATHS, QUIZ_CONSTANTS } from './constants';

/**
 * Web Audio API를 사용한 폴백 사운드 생성
 */
const createFallbackSound = (type: 'correct' | 'wrong' | 'record' | 'timer') => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        switch (type) {
            case 'correct': {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.2);
                oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.3);

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.4);
                break;
            }

            case 'wrong': {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.type = 'sawtooth';
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(120, audioContext.currentTime + 0.25);

                gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.25);
                break;
            }

            case 'record': {
                const oscillator1 = audioContext.createOscillator();
                const oscillator2 = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator1.type = 'sine';
                oscillator1.frequency.setValueAtTime(523, audioContext.currentTime);
                oscillator1.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
                oscillator1.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);

                oscillator2.type = 'sine';
                oscillator2.frequency.setValueAtTime(659, audioContext.currentTime);
                oscillator2.frequency.setValueAtTime(784, audioContext.currentTime + 0.1);
                oscillator2.frequency.setValueAtTime(1047, audioContext.currentTime + 0.2);

                oscillator1.connect(gainNode);
                oscillator2.connect(gainNode);
                gainNode.connect(audioContext.destination);

                gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

                oscillator1.start(audioContext.currentTime);
                oscillator2.start(audioContext.currentTime);

                setTimeout(() => {
                    oscillator1.stop();
                    oscillator2.stop();
                    audioContext.close();
                }, 800);
                break;
            }

            case 'timer': {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioContext.currentTime);

                gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + QUIZ_CONSTANTS.COUNTDOWN_BEEP_DURATION);

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.start();
                oscillator.stop(audioContext.currentTime + QUIZ_CONSTANTS.COUNTDOWN_BEEP_DURATION);
                break;
            }
        }
    } catch (error) {
        console.error(`폴백 사운드 생성 실패 (${type}):`, error);
    }
};

/**
 * 정답 효과음 재생
 */
export const playCorrectSound = (): void => {
    try {
        const audio = new Audio(SOUND_PATHS.SUCCESS);
        audio.volume = 0.7;

        audio.play()
            .then(() => console.log('정답 사운드 재생 완료'))
            .catch((error) => {
                console.warn('success.mp3 재생 실패, 폴백 사운드 사용:', error);
                createFallbackSound('correct');
            });
    } catch (error) {
        console.error('정답 사운드 재생 실패:', error);
        createFallbackSound('correct');
    }
};

/**
 * 오답 효과음 재생
 */
export const playWrongSound = (): void => {
    try {
        const audio = new Audio(SOUND_PATHS.WRONG);
        audio.volume = 0.7;

        audio.play()
            .then(() => console.log('오답 사운드 재생 완료'))
            .catch((error) => {
                console.warn('wrong.mp3 재생 실패, 폴백 사운드 사용:', error);
                createFallbackSound('wrong');
            });
    } catch (error) {
        console.error('오답 사운드 재생 실패:', error);
        createFallbackSound('wrong');
    }
};

/**
 * 신기록 달성 사운드 재생
 */
export const playRecordSound = (): void => {
    try {
        const audio = new Audio(SOUND_PATHS.RECORD);
        audio.volume = 0.7;

        audio.play()
            .then(() => console.log('신기록 사운드 재생 완료'))
            .catch((error) => {
                console.warn('record.mp3 재생 실패, 폴백 사운드 사용:', error);
                createFallbackSound('record');
            });
    } catch (error) {
        console.error('신기록 사운드 재생 실패:', error);
        createFallbackSound('record');
    }
};

/**
 * 타이머 경고음 재생 (마지막 3초)
 */
export const playTimerSound = (): void => {
    try {
        const audio = new Audio(SOUND_PATHS.TIMER);
        audio.volume = 0.5;

        audio.play()
            .then(() => console.log('타이머 사운드 재생 완료'))
            .catch((error) => {
                console.warn('timer.mp3 재생 실패, 폴백 사운드 사용:', error);
                createFallbackSound('timer');
            });
    } catch (error) {
        console.error('타이머 사운드 재생 실패:', error);
        createFallbackSound('timer');
    }
};
