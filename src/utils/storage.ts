/**
 * localStorage 타입 안전 래퍼
 */

/**
 * localStorage에서 값을 가져옵니다
 */
export function getItem<T>(key: string, defaultValue?: T): T | null {
    try {
        const item = localStorage.getItem(key);
        if (item === null) {
            return defaultValue ?? null;
        }
        return JSON.parse(item) as T;
    } catch (error) {
        console.error(`localStorage getItem 오류 (key: ${key}):`, error);
        return defaultValue ?? null;
    }
}

/**
 * localStorage에 값을 저장합니다
 */
export function setItem<T>(key: string, value: T): boolean {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`localStorage setItem 오류 (key: ${key}):`, error);
        return false;
    }
}

/**
 * localStorage에서 값을 제거합니다
 */
export function removeItem(key: string): boolean {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`localStorage removeItem 오류 (key: ${key}):`, error);
        return false;
    }
}

/**
 * localStorage를 모두 비웁니다
 */
export function clear(): boolean {
    try {
        localStorage.clear();
        return true;
    } catch (error) {
        console.error('localStorage clear 오류:', error);
        return false;
    }
}
