# this file is to test Dockerfile VOLUME operations to see if our volume delete works
FROM alpine:latest

WORKDIR /app

# Declare a volume at /app/data
VOLUME ["/app/data"]

# Declare a volume at /app/test
VOLUME ["/app/test"]

# Dummy command to keep the container running
CMD ["sh", "-c", "echo 'Volume mounted at /app/data'; sleep infinity"]

# run with `docker build -f Volume.Data.Test.Dockerfile -t volume-demo .`