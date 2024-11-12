import { OpState } from "@nosana/sdk";

export const mockedBenchmarkOpstate: OpState[] = [
        {
            "operationId": "gpu",
            "providerId": "92cff5d3149b4b6bcc8253717793161aeb3dbf00adb439a7bb00fca1e439f2b4",
            "status": "success",
            "startTime": 1731420648877,
            "endTime": 1731420653952,
            "exitCode": 0,
            "logs": [
                {
                    "type": "stdout",
                    "log": "{\"devices\": [{\"index\": 0, \"name\": \"NVIDIA GeForce RTX 3060\", \"uuid\": \"GPU-705aedd7-9f63-5e0f-5911-bf16f883a904\", \"results\": [7,9,11,13,15]}]}\n"
                }
            ]
        },
        {
            "operationId": "disk-space",
            "providerId": "7de92a74b5b35a647015b91a9c2a61903386ffb046ed9c51a607bcfef38234e0",
            "status": "success",
            "startTime": 1731420623047,
            "endTime": 1731420626211,
            "exitCode": 0,
            "logs": [
                {
                    "type": "stdout",
                    "log": "25000G\n"
                }
            ]
        },
    ]