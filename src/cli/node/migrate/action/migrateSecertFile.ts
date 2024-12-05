import fs from 'fs';
import path from 'path';

export function migrateSecertFile(walletPath: string) {
  const compromisedPath = path.join(
    path.dirname(walletPath),
    `${path.basename(walletPath)}.compromised`,
  );

  fs.renameSync(walletPath, compromisedPath);
}
