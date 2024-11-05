export function hoursSinceDate(date: Date): number {
  return Math.abs(date.getTime() - new Date().getTime()) / 36e5;
}
