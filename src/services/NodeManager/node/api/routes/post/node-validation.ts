import typia from 'typia';
import { Response } from 'express';
import { JobDefinition } from '@nosana/sdk';

import { getSDK } from '../../../../../sdk.js';
import { NodeAPIRequest } from '../../types/index.js';
import { clientSelector } from '../../../../../../api/client.js';
import { generateRandomId } from '../../../../../../providers/utils/generate.js';
import TaskManager from '../../../task/TaskManager.js';

export async function postNodeValidation(
  req: NodeAPIRequest<{}, JobDefinition>,
  res: Response,
) {
  const sdk = getSDK();
  const client = clientSelector();
  const provider = req.provider!;
  const repository = req.repository!;
  const validator = typia.createValidateEquals<JobDefinition>();

  if (!req.body) {
    return res.status(400).send('Missing job definition.');
  }

  const isValid = validator(req.body);

  if (!isValid.success) {
    res.status(400).send(
      JSON.stringify({
        error: 'Failed to validate job defintion.',
        message: isValid.errors,
      }),
    );
  }

  const sessionId = res.locals['session_id']!;

  if (sessionId !== 'ADMIN') {
    res.status(200).send();
  }

  const id = generateRandomId(32);

  try {
    const task = new TaskManager(provider, repository, id, sessionId, req.body);
    task.bootstrap();
    await task.start();

    const result = repository.getflow(id);

    if (sessionId === 'ADMIN') {
      res.status(200).send(result.state.opStates[0].results!['prediction'][0]);
      return;
    }

    await client.POST('/api/benchmarks/submit', {
      // @ts-ignore WAITING ON ENDPOINT CREATION + DEFINING THE RESPONSE OBJECT
      body: result.state,
      params: {
        header: {
          authorization: sdk.authorization.generate(sessionId, {
            includeTime: true,
          }),
        },
      },
    });
  } catch (error) {
    throw error;
  }
}
