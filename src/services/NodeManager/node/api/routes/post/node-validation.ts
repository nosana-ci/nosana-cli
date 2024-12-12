import typia from 'typia';
import { Response } from 'express';
import { JobDefinition } from '@nosana/sdk';

import { NodeAPIRequest } from '../../types/index.js';
import { clientSelector } from '../../../../../../api/client.js';

export async function postNodeValidation(
  req: NodeAPIRequest<{}, JobDefinition>,
  res: Response,
) {
  if (!req.body) {
    return res.status(400).send('Missing job definition.');
  }

  const client = clientSelector();
  const flowHandler = req.flowHandler!;
  const validator = typia.createValidateEquals<JobDefinition>();
  const isValid = validator(req.body);

  if (!isValid.success) {
    res.status(400).send(
      JSON.stringify({
        error: 'Failed to validate job defintion.',
        message: isValid.errors,
      }),
    );
  }

  res.status(200).send();

  const id = flowHandler.generateRandomId(32);
  flowHandler.start(id, req.body);

  try {
    let result = await flowHandler.run(id);
    // @ts-ignore WAITING ON ENDPOINT CREATION + DEFINING THE RESPONSE OBJECT
    client.POST('/api/nodes/TBC', {
      body: JSON.stringify(result),
    });
  } catch (error) {
    throw error;
  }
}
