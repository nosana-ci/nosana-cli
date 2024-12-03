import { DockerContainerOrchestration } from './DockerContainerOrchestration.js';
import { ContainerOrchestrationInterface } from './interface.js';
import { PodmanContainerOrchestration } from './PodmanContainerOrchestration.js';

export function selectContainerOrchestrationProvider(
  provider: string,
  url: string,
  gpu: string,
): ContainerOrchestrationInterface {
  switch (provider) {
    case 'podman':
      return new PodmanContainerOrchestration(url, gpu);
    case 'docker':
    default:
      return new DockerContainerOrchestration(url, gpu);
  }
}
