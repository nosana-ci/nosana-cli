import {
  HFResource,
  OllamaResource,
  S3Resource,
} from '@nosana/sdk/dist/types/resources.js';
import { RequiredResource } from '@nosana/sdk'
import { nosanaBucket } from '../definition/index.js';

export function createResourceName(resource: RequiredResource) {
  switch (resource.type) {
    case 'S3':
      const s3Resource = resource as S3Resource;
      if (s3Resource.url) {
        return s3Resource.url.replace(
          's3://nos-ai-models-qllsn32u',
          nosanaBucket,
        );
      }
      return s3Resource.buckets!.map((bucket) => bucket.url).join('-');
    case 'HF':
      const hfResource = resource as HFResource;
      return `${hfResource.repo}${
        hfResource.revision ? '-' + hfResource.revision : ''
      }${hfResource.files ? '-' + hfResource.files.join('-') : ''}`;
    case 'Ollama':
      return (resource as OllamaResource).model;
  }
}
