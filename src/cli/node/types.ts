export type CudaCheckResponse = {
  devices: CudaCheckSuccessResponse | undefined;
  error: CudaCheckSuccessResponse | undefined;
};

export type CudaCheckSuccessResponse = {
  index: number;
  name: string;
  uuid: string;
  results: number[];
}[];

export type CudaCheckErrorResponse = {
  runtime_version: number;
  is_cuda_available: boolean;
  reason: string;
  expection: string;
};
