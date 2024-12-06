import fs from 'fs';
import path from 'path';

export function migrateSecertFile(
  walletPath: string,
  suspectedPublicKey: string,
) {
  const compromisedPath = path.join(
    path.dirname(walletPath),
    `${path.basename(walletPath)}.compromised.${suspectedPublicKey}`,
  );

  fs.renameSync(walletPath, compromisedPath);
}
