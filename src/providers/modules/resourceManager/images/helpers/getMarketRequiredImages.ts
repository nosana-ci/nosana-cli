import { apiClient } from '../../../../../api/client.js';

export async function getMarketRequiredImages(id: string): Promise<string[]> {
  const { data, error } = await apiClient.GET(
    '/api/markets/{id}/required-images',
    {
      params: {
        path: {
          id,
        },
      },
    },
  );

  if (error) {
    throw new Error(`Failed to fetch market required images: ${error.message}`);
  }

  return data;
}
