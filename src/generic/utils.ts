import { Console } from 'console';
import { Transform } from 'stream';
import inquirer from 'inquirer';

/**
 * Method to pause the process
 * @param seconds Number of seconds to pause
 */
const sleep = (seconds: number): Promise<void> =>
  new Promise((res) => setTimeout(res, seconds * 1e3));

/**
 * Method to easily get a universal timestamp
 */
const now = (): number => Math.floor(Date.now() / 1e3);

async function askYesNoQuestion(
  question: string,
  onYes: () => Promise<void>,
  onNo: () => void,
): Promise<void> {
  return inquirer
    .prompt([
      {
        type: 'input',
        name: 'confirm',
        message: question,
        default: 'y',
        validate: (input: string) => {
          const lowerInput = input.toLowerCase();
          if (
            lowerInput === 'y' ||
            lowerInput === 'yes' ||
            lowerInput === 'n' ||
            lowerInput === 'no'
          ) {
            return true; // Valid input
          }
          return 'Please enter "y" or "yes" for yes or "n" or "no" for no.'; // Repeat question if invalid
        },
        filter: (input: string) => input.toLowerCase(), // Normalize input to lowercase
      },
    ])
    .then((answers) => {
      if (answers.confirm === 'y' || answers.confirm === 'yes') {
        return onYes();
      } else {
        onNo();
      }
    });
}

const clearLine = () => {
  process.stdout.moveCursor(0, -1); // up one line
  process.stdout.clearLine(1); // from cursor to end
};

const colors = {
  RED: '\u001b[1;31m',
  GREEN: '\u001b[1;32m',
  YELLOW: '\u001b[1;33m',
  BLUE: '\u001b[1;34m',
  CYAN: '\u001b[1;36m',
  WHITE: '\u001b[1;38;5;231m',
  RESET: '\u001b[0m',
};

/**
 * Method to test and cast strings into string arrays
 * @param {string | string[]} value The string or string array being tested and casted
 * @returns { string[] } Returns a string array
 */
const ifStringCastToArray = (value: string | string[]) =>
  typeof value === 'string' ? [value] : value;

function logTable(data: any) {
  if (data && data.length > 0) {
    const ts = new Transform({
      transform(chunk, enc, cb) {
        cb(null, chunk);
      },
    });
    const logger = new Console({ stdout: ts });
    logger.table(data);
    const table = (ts.read() || '').toString();
    let result = '';
    for (let row of table.split(/[\r\n]+/)) {
      let r = row.replace(/[^┬]*┬/, '┌');
      r = r.replace(/^├─*┼/, '├');
      r = r.replace(/│[^│]*/, '');
      r = r.replace(/^└─*┴/, '└');
      r = r.replace(/'/g, ' ');
      result += `${r}\n`;
    }
    console.log(result);
    clearLine();
  } else {
    console.log('[]');
  }
}

function isNodeOnboarded(status: string): boolean {
  return ['ONBOARDED', 'PREMIUM'].includes(status);
}

const SECONDS_PER_DAY = 24 * 60 * 60;

export {
  logTable,
  now,
  sleep,
  clearLine,
  askYesNoQuestion,
  colors,
  ifStringCastToArray,
  SECONDS_PER_DAY,
  isNodeOnboarded,
};
