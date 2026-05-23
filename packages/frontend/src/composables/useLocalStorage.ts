import { ref, watch, type Ref } from 'vue';

export function useLocalStorage<T>(key: string, initialValue: T): Ref<T | null> {
    let data: T = initialValue;
    let storedValue: string | null = null;

    try {
        storedValue = localStorage.getItem(key);
    } catch (e) {
        console.error(`Error reading localStorage key "${key}":`, e);
    }

    if (storedValue) {
        if (typeof initialValue === 'number') {
            const parsed = Number(storedValue);
            if (!isNaN(parsed)) {
                data = parsed as any;
            }
        } else if (typeof initialValue === 'boolean') {
            if (storedValue === 'true') {
                data = true as any;
            } else if (storedValue === 'false') {
                data = false as any;
            }
        } else {
            try {
                data = JSON.parse(storedValue);
            } catch {
                data = storedValue as any;
            }
        }
    }

    const value = ref<T | null>(data) as Ref<T | null>;

    watch(
        value,
        newValue => {
            if (newValue === undefined || newValue === null) {
                localStorage.removeItem(key);
            } else {
                try {
                    localStorage.setItem(key, JSON.stringify(newValue));
                } catch (e) {
                    console.error(`Error saving to localStorage key "${key}":`, e);
                }
            }
        },
        { deep: true }
    );

    return value;
}
