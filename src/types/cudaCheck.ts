export type CudaCheckResponse =
  | CudaCheckSuccessResponse
  | CudaCheckErrorResponse;

export type CudaCheckSuccessResponse = {
  devices: {
    index: number;
    name: string;
    uuid: string;
    memory: {
      total_mb: number;
    };
    network_architecture: {
      major: number;
      minor: number;
    };
    results: number[];
  }[];
  runtime_version: number;
  cuda_driver_version: number;
  nvml_driver_version: string;
};

export type CudaCheckErrorResponse = {
  error: {
    runtime_version: number;
    is_cuda_available: boolean;
    reason: string;
    expection: string;
  };
};
