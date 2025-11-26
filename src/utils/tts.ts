import { TTSSettings, DEFAULT_TTS_SETTINGS } from './constants';
import { getItem, setItem } from './storage';

const TTS_SETTINGS_KEY = 'ttsSettings';

/**
 * localStorage에서 TTS 설정을 가져옵니다
 */
export const getTTSSettings = (): TTSSettings => {
    return getItem<TTSSettings>(TTS_SETTINGS_KEY, DEFAULT_TTS_SETTINGS) || DEFAULT_TTS_SETTINGS;
};

/**
 * TTS 설정을 localStorage에 저장합니다
 */
export const saveTTSSettings = (settings: TTSSettings): boolean => {
    return setItem(TTS_SETTINGS_KEY, settings);
};

/**
 * 음성 목록을 로드합니다
 */
const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve(voices);
        } else {
            window.speechSynthesis.onvoiceschanged = () => {
                resolve(window.speechSynthesis.getVoices());
            };
            setTimeout(() => resolve([]), 1000);
        }
    });
};

/**
 * 음성 목록에서 설정에 맞는 음성을 선택합니다
 */
const selectVoice = (
    voices: SpeechSynthesisVoice[],
    settings: TTSSettings
): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    const preferLang = settings.accent === 'uk' ? 'en-GB' : 'en-US';

    // 언어 매칭
    let candidates = voices.filter(v => v.lang?.toLowerCase() === preferLang.toLowerCase());
    if (candidates.length === 0) {
        const langCode = preferLang.split('-')[0].toLowerCase();
        candidates = voices.filter(v => v.lang?.toLowerCase().startsWith(langCode));
    }
    if (candidates.length === 0) {
        candidates = voices.filter(v => v.lang?.toLowerCase().includes('en'));
    }

    if (candidates.length === 0) return null;

    // 성별 매칭
    if (settings.gender === 'female') {
        return candidates.find(v =>
            /female|woman|amy|emma|olivia|salli|joanna|ivy|kimberly|kendra|zira|susan/i.test(v.name)
        ) || candidates[0];
    } else if (settings.gender === 'male') {
        return candidates.find(v =>
            /male|man|brian|daniel|arthur|matthew|justin|joey|david|mark|alex/i.test(v.name)
        ) || candidates[0];
    }

    return candidates[0];
};

/**
 * 텍스트를 음성으로 읽습니다
 */
export const speakText = async (text: string, customSettings?: Partial<TTSSettings>): Promise<void> => {
    if (!('speechSynthesis' in window)) {
        console.error('이 브라우저는 음성 합성을 지원하지 않습니다.');
        return;
    }

    try {
        window.speechSynthesis.cancel();

        const settings = { ...getTTSSettings(), ...customSettings };
        const voices = await loadVoices();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = settings.accent === 'uk' ? 'en-GB' : 'en-US';
        utterance.rate = settings.rate;
        utterance.pitch = settings.gender === 'male' ? 0.8 : settings.gender === 'female' ? 1.3 : 1.0;

        const selectedVoice = selectVoice(voices, settings);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log('Selected voice:', selectedVoice.name, selectedVoice.lang);
        }

        window.speechSynthesis.speak(utterance);
    } catch (error) {
        console.error('음성 재생 오류:', error);
    }
};

/**
 * 음성 재생을 중지합니다
 */
export const stopSpeaking = (): void => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
};
