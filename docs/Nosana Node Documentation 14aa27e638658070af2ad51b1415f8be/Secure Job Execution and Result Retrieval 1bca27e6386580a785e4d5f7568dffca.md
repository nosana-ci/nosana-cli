# Secure Job Execution and Result Retrieval

This document outlines how we customize jobs to run privately. There are three key interactions that we provide functionality to make private:

1. **Job Definition**: For clients who don’t want their job definition on IPFS (public), we provide a way for them to securely provide hosts with the job definition directly or through a private method.
2. **Result Retrieval**: By default, job logs and results are sent to IPFS (public). For clients who require a private way to retrieve results, we provide a secure method for accessing this data.
3. **Exposed URL**: After running an exposed service on a host and generating an exposed endpoint, some clients may want that URL to remain private (non-deterministic). We provide a way to secure the endpoint and allow only authorized users to retrieve it.

---

# **Job Definition Privacy**

To securely pass a Job Definition to the Host, we edit the Job Definition to omit the operations (`ops`) and specify how the Job Definition will be sent. Currently, we have implemented `api-listen` as the secure transmission method, with additional methods planned for future support.

### **Example: Standard Public Job Definition**

```
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
        "image": "ubuntu"
      }
    }
  ]
}
```

### **Step 1: Creating a Secure Job Definition**

To run this job securely, we create a private Job Definition by omitting `ops` and specifying a `logistics` object with a `send` method.

```
{
  "version": "0.1",
  "type": "container",
  "meta": {
    "trigger": "cli"
  },
  "logistics": {
    "send": {
      "type": "api-listen",
      "args": {}
    }
  },
  "ops": []
}
```

- The `send` method defines that the real Job Definition will be transmitted securely using `api-listen`.
- The host recognizes this and opens an API endpoint to securely listen for the real Job Definition.

### **Step 2: Submitting the Private Job**

Once the private Job Definition is created, we submit the job as usual:

```
nosana job post --file private-job-template.json --wait -t 60
```

- The job enters the queue like any public job.
- A host picks up the job and recognizes that it’s private.
- The host pauses and waits for the real Job Definition to be sent securely.

### **Step 3: Sending the Real Job Definition**

Once the host is ready, the client sends the full job definition using a secure HTTP request.

```
NODE_ID="${NODE_ID}"  # The host that picked up the job
JOB_ID="<your-job-id>"  # The job ID
SESSION_ID="<your-session-id>"  # Authentication session ID

curl -X POST "http://${NODE_ID}.node.k8s.prd.nos.ci/job-definition/${JOB_ID}" \
     -H "x-session-id: ${SESSION_ID}" \
     -H "Content-Type: application/json" \
     -d '{
           "jobDefinition": {
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
                   "image": "ubuntu"
                 }
               }
             ]
           }
         }'
```

- The host verifies the session ID before proceeding.
- Once the Job Definition is received, the job is executed securely.

---

# **Private Result Retrieval**

By default, job results (logs and execution output) are stored on IPFS. However, for privacy-conscious clients, we provide a secure way to retrieve results using the `receive` logistics type.

### **Step 1: Creating a Secure Result Retrieval Method**

To ensure that results are retrieved privately, we specify a `receive` method in the Job Definition.

```
{
  "version": "0.1",
  "type": "container",
  "meta": {
    "trigger": "cli",
  },
  "logistics": {
    "receive": {
      "type": "api-listen",
      "args": {}
    }
  },
  "ops": []
}
```

- The `receive` object specifies that results will be retrieved securely using `api-listen`.
- The job runs like any public job and is only different when it's done running and wants to process results.
- The host waits and listens for the client to make an HTTP protected GET request to retrieve the results before ending the job.

### **Step 2: Retrieving the Secure Job Result**

Once the job is complete, the client retrieves the results using a secure API request:

```
NODE_ID="${NODE_ID}"  # The host that picked up the job
JOB_ID="<your-job-id>"  # The job ID
SESSION_ID="<your-session-id>"  # Authentication session ID

curl -X GET "http://${NODE_ID}.node.k8s.prd.nos.ci/job-result/${JOB_ID}" \
     -H "x-session-id: ${SESSION_ID}" \
     -H "Accept: application/json"
```

- The host verifies authentication before returning results.
- The results are transmitted securely.
- Then an empty result (only running information) is posted to IPFS without any logs or results.

Note:

- `send` ensures private job submission.
- `receive` ensures private result retrieval.
- These functionalities can be used separately or together as shown below:

```json
{
  "version": "0.1",
  "type": "container",
  "meta": {
    "trigger": "cli"
  },
  "logistics": {
    "send": {
      "type": "api-listen",
      "args": {}
    },
    "receive": {
      "type": "api-listen",
      "args": {}
    }
  },
  "ops": []
}
```

# **Private Exposed URL**

To prevent the host from generating a deterministic URL, it needs to be specified in the `ops`. Since exposed URLs are tied to specific operations, any operations the client wants to be private can be set as shown below:

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
      "id": "nginx",
      "args": {
        "cmd": [],
        "image": "nginx",
        "expose": 80,
        "private": true, // this makes the exposed url private <-
      }
    }
  ]
}

```

If this is set to true, the job can be posted as normal and then the private exposed URL can be obtained from a secure endpoint from the host.

```
NODE_ID="${NODE_ID}"  # The host that picked up the job
JOB_ID="<your-job-id>"  # The job ID
SESSION_ID="<your-session-id>"  # Authentication session ID

curl -X GET "http://${NODE_ID}.node.k8s.prd.nos.ci/service/url/${JOB_ID}" \
     -H "x-session-id: ${SESSION_ID}" \
     -H "Accept: application/json"
```

Then a response containing all URLs for the job is returned securely:

```json
{
  "urls": {
    "nUByV4RDjEfgC2Y714gk2ZavNtSdxafaN3iJKCRopwZfL": {
      "port": 80,
      "url": "https://nUByV4RDjEfgC2Y714gk2ZavNtSdxafaN3iJKCRopwZfL.node.k8s.dev.nos.ci"
    }
  },
  "status": "ONLINE"
}
```