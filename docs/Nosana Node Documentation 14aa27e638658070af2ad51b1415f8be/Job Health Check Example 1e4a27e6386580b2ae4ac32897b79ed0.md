# Job Health Check Example

In this write-up, we will go through the steps of creating an image with the sole intent of using the job health check functionality. The health check functionality is triggered by specifying a process of liveness (for exposed operations) check in the Job Definition file as shown below:

```jsx
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
        "expose": [ 
          { 
            "port": 80, 
            "health_checks": [
              {
                "type": "http",
                "path": "/",
                "method": "GET",
                "expected_status": 200
              }
            ] 
          }
        ]
      }
    }
  ]
}

```

The health check is per port and can have multiple health checks per port.

## Setting Up a Project Folder to use to show health check functionality

```jsx
my-local-healthcheck/
├── Dockerfile
├── index.js
```

```jsx
// index.js
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy' }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(8080, () => {
  console.log('Server running on http://localhost:8080');
});
```

This is the index file where we create a server that exposes the `/health` endpoint to be used for the health check.

```docker
FROM node:18-alpine

WORKDIR /app
COPY index.js .

EXPOSE 8080

CMD ["node", "index.js"]
```

This is the Dockerfile that will be used to build the image for use in the Job Definition.

```docker
docker build -t my-local-image .
```

This will build the image, and that image will be used in the Job Definition.

After creating and building the image, it can now be used in the Job Definition.

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
      "id": "local-check",
      "args": {
        "cmd": [],
        "image": "my-local-image",
        "expose": [
          {
            "port": 8080,
            "health_checks": [
              {
                "type": "http",
                "path": "/health",
                "method": "GET",
                "expected_status": 200
              }
            ]
          }
        ]
      }
    }
  ]
}

```

This will be the Job Definition for running this image. The health check goes to path `/health` and uses `http` and `GET` method, so now after every interval this endpoint is called and liveness is confirmed.