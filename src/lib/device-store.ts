import { File, Paths } from "expo-file-system";

/**
 * Small JSON kept on this phone (the web keeps the same in localStorage).
 * Best effort: anything that can't be read or written is simply not kept.
 */
export const deviceStore = {
    async get<T>(name: string): Promise<T | null> {
        try {
            const file = new File(Paths.document, `${name}.json`);
            return file.exists ? JSON.parse(await file.text()) as T : null;
        } catch {
            return null;
        }
    },
    async set(name: string, value: unknown): Promise<void> {
        try {
            const file = new File(Paths.document, `${name}.json`);
            if (!file.exists) file.create();
            await file.write(JSON.stringify(value));
        } catch {
            // Not kept on this phone; the flow still works.
        }
    },
    remove(name: string): void {
        try {
            const file = new File(Paths.document, `${name}.json`);
            if (file.exists) file.delete();
        } catch {
            // Nothing to clear.
        }
    },
};
