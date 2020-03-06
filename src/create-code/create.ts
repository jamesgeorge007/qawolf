import callsites from 'callsites';
import Debug from 'debug';
import { pathExists, readFile } from 'fs-extra';
import { findLast } from 'lodash';
import { basename, dirname, join } from 'path';
import { BrowserContext } from 'playwright';
import { CREATE_HANDLE } from './CodeUpdater';
import { CreateManager } from './CreateManager';
import { getLineIncludes } from './format';

type CreateOptions = {
  codePath?: string;
  context: BrowserContext;
  selectorPath?: string;
};

const debug = Debug('qawolf:create');

export const getCodePath = async (): Promise<string> => {
  const callerFileNames = callsites().map(c => c.getFileName());
  debug(`search caller files for ${CREATE_HANDLE} %j`, callerFileNames);

  const codes = await Promise.all(
    callerFileNames.map(async filename => {
      let code = '';

      if (await pathExists(filename)) {
        code = await readFile(filename, 'utf8');
      }

      return { code, filename };
    }),
  );

  const item = findLast(
    codes,
    ({ code }) => !!getLineIncludes(code, CREATE_HANDLE),
  );

  if (!item) {
    throw new Error(`Could not find ${CREATE_HANDLE} in caller`);
  }

  return item.filename;
};

export const getSelectorPath = (codePath: string): string => {
  const codeName = basename(codePath).split('.')[0];
  return join(dirname(codePath), '../selectors', `${codeName}.json`);
};

export const create = async (options: CreateOptions): Promise<void> => {
  const codePath = options.codePath || (await getCodePath());
  const selectorPath = options.selectorPath || getSelectorPath(codePath);
  await CreateManager.run({
    codePath,
    // TODO make optional by checking repl for context
    context: options.context,
    selectorPath,
  });
};
