import type { WriteStream } from 'fs-extra';
import { move, remove, writeFile, readFile, createWriteStream } from 'fs-extra';
import { join } from 'path';
import tempy from 'tempy';

export function parseList(str: string): string[] {
  return str
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getEnvConfig(program: Record<string, any>, configEnv: Record<string, any>): void {
  Object.keys(configEnv).forEach((fieldName) => {
    const envVarName = configEnv[fieldName];
    const envVarValue = process.env[envVarName];
    if (envVarValue) {
      // eslint-disable-next-line no-param-reassign
      program[fieldName] = envVarValue;
    }
  });
}

/**
 * Given a file name, creates an object with utilities to manage a log file.
 * It creates a temporary log file which you can manage with the returned functions.
 * You can then decide whether to move the log file to the users project, or remove it.
 *
 * @example
 * ```
 *  const { logStream, moveLogFile, removeLogFile, clearLogFile, readLogFile } = await createLogStream('my-log-file.log');
 *
 *  // SCENARIO 1:
 *  // you can write custom messages to generate a log file
 *  logStream.write('my log message');
 *  await moveLogFile();
 *
 *  // SCENARIO 2:
 *  // or you can pass it to stdio and capture the output of that command
 *  try {
 *    await this.executeCommand({
 *      command: 'pnpm',
 *      args: ['info', packageName, ...args],
 *      // do not output to the user, and send stdio and stderr to log file
 *      stdio: ['ignore', logStream, logStream]
 *    });
 *  } catch (err) {
 *    // do something with the log file content
 *    const output = await readLogFile();
 *    // move the log file to the users project
 *    await moveLogFile();
 *  }
 *  // success, no need to keep the log file
 *  await removeLogFile();
 *
 * ```
 */
export const createLogStream = async (
  logFileName: string
): Promise<{
  moveLogFile: () => Promise<void>;
  removeLogFile: () => Promise<void>;
  clearLogFile: () => Promise<void>;
  readLogFile: () => Promise<string>;
  logStream: WriteStream;
}> => {
  const finalLogPath = join(process.cwd(), logFileName);
  const temporaryLogPath = tempy.file({ name: logFileName });

  const logStream = createWriteStream(temporaryLogPath, { encoding: 'utf8' });

  return new Promise((resolve, reject) => {
    logStream.once('open', () => {
      const moveLogFile = async () => move(temporaryLogPath, finalLogPath, { overwrite: true });
      const clearLogFile = async () => writeFile(temporaryLogPath, '');
      const removeLogFile = async () => remove(temporaryLogPath);
      const readLogFile = async () => {
        return readFile(temporaryLogPath, 'utf8'); // .replace(/[\x00-\x1F\x7F]/g, '');
      };
      resolve({ logStream, moveLogFile, clearLogFile, removeLogFile, readLogFile });
    });
    logStream.once('error', reject);
  });
};
