import { nosanaBucket } from "../../../../../providers/modules/resourceManager/volumes/definition/s3HelperOpts";
import { RequiredResource } from "../../../provider/types";

export function createResourceName(resource: RequiredResource) {
    if (resource.url)
      return resource.url.replace('s3://nos-ai-models-qllsn32u', nosanaBucket);
  
    // TODO: Fix type to ensure that it is either url or bucket!
    return resource.buckets!.map((bucket) => bucket.url).join('-');
  }
  