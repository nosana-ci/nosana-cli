import typia from 'typia';
import { Response } from 'express';
import { JobDefinition } from '@nosana/sdk';

import { getSDK } from '../../../../../sdk.js';
import { NodeAPIRequest } from '../../types/index.js';
import { clientSelector } from '../../../../../../api/client.js';

export async function postNodeValidation(
  req: NodeAPIRequest<{}, JobDefinition>,
  res: Response,
) {
  const sdk = getSDK();
  const client = clientSelector();
  const flowHandler = req.flowHandler!;
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

  const id = flowHandler.generateRandomId(32);
  flowHandler.start(id, req.body);

  try {
    let result = await flowHandler.run(id);

    if (sessionId === 'ADMIN') {
      res
        .status(200)
        .send(parseFloat(result.state.opStates[0].results!['prediction'][0]));
      return;
    }
    // @ts-ignore WAITING ON ENDPOINT CREATION + DEFINING THE RESPONSE OBJECT
    await client.POST('/api/benchmarks/submit', {
      body: result,
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
