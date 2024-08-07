import 'rpc-websockets/dist/lib/client.js';
import { clearLine, colors, logTable } from '../../../generic/utils.js';
import { clientSelector } from '../../../api/client.js';

export async function getMarkets(options: {
  [key: string]: any;
}): Promise<void> {
  console.log('\nMarkets');
  const { data: markets, error }: any = await clientSelector().GET(
    '/api/markets/',
  );
  if (error) throw new Error(`Failed to fetch markets \n${error.message}`);

  const viewTable = markets.map((m: any) => {
    return {
      name: m.name,
      slug: m.slug,
      address: m.address,
    };
  });
  logTable(viewTable);
}
