export function generateRandomId(length: number): string {
    return [...Array(length)].map(() => Math.random().toString(36)[2]).join('');
}