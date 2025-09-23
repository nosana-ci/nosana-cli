# Getting Service URL

to get the service url of a job, 3 items are required

The SDK

```jsx
import { getJobExposedServices } from "@nosana/sdk";
```

The Job Definition

```json
{
  "version": "0.1",
  "type": "container",
  "meta": {
    "trigger": "cli"
  },
  "ops": [
    {
      "type": "container/run",
      "id": "hello-world",
      "args": {
        "cmd": "echo hello world",
        "image": "ubuntu",
        "expose": [3000, 8080]
      }
    }
  ]
}
```

The JobID: this can be gotten from `list()` (when the deployment is made)

```jsx
3EwUexRdXedDk2EL72py5FQd9fG2aVR9trD3EqEbGCDu
```

Then we can call the `getJobExposedServices` using this variables `JobDefinition` and `JobID` 

```jsx
import { getJobExposedServices } from "@nosana/sdk";

const services = getJobExposedServices(jobDefinition, jobId);

// if there are multiple exposed port we will have multiple services so we can get multiple hashes

for (const service of services) {
    // the hash can be concatinated to the rest of the url to get the service url
    const serviceUrl = `https://${service.hash}.node.k8s.prd.nos.ci`;
}
```