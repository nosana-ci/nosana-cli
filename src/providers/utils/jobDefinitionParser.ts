import fs from 'fs';
import path from 'path';
import { parse as parseYaml, stringify as toYaml } from 'yaml';

/**
 * Converts a YAML string to a JSON-compatible object.
 */
export function yamlToJson(yamlString: string): any {
  return parseYaml(yamlString);
}

/**
 * Converts a JSON-compatible object to a YAML string.
 */
export function jsonToYaml(obj: any): string {
  return toYaml(obj);
}

/**
 * Loads a job definition file (YAML or JSON) and returns the parsed object.
 */
export function loadJobDefinitionFromFile(filePath: string): any {
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf-8');

  if (ext === '.yaml' || ext === '.yml') {
    return yamlToJson(raw);
  } else if (ext === '.json') {
    return JSON.parse(raw);
  } else {
    throw new Error(
      `Unsupported file extension: ${ext}. Expected .json, .yaml or .yml`,
    );
  }
}
