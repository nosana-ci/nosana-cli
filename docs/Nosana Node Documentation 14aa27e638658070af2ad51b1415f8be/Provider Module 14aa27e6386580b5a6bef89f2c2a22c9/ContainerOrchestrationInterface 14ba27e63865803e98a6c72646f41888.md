# ContainerOrchestrationInterface

This is the Interface in which the containerization technology is implemented, for now we implemented only podman (`PodmanContainerOrchestration`) and docker(`DockerContainerOrchestration`) .

In this same module we have a the `selectContainerOrchestrationProvider` which is a factory method used to select the correct type of containerization technology.