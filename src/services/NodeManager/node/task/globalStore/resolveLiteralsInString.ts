import TaskManager from '../TaskManager.js';

export function resolveLiteralsInString(
  this: TaskManager,
  input: string,
): string {
  const LITERAL_RE = /%%ops\.([^.]+)\.([%A-Za-z0-9._-]+)%%/g;

  return input.replace(LITERAL_RE, (_m, opId: string, path: string) => {
    const value = this.getByPath(opId, path as string);
    return value == null ? '' : String(value);
  });
}
