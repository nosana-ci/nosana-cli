# ResourceManager

`ResourceManager.ts`

The `ResourceManager` class manages resources required for container orchestration in a node environment. It ensures that images and volumes are synchronized, fetched, and maintained to meet the requirements of a specified market. The `ResourceManager` integrates with `ImageManager` and `VolumeManager` for detailed image and volume operations, providing a cohesive resource management workflow.

### **Core Responsibilities**

1. **Resource Synchronization**
    - Resyncs the database with the latest images and volumes.
    - Ensures that required market resources are fetched and updated.
2. **Resource Fetching**
    - Fetches required images and volumes for a specific market.
3. **Pruning Resources**
    - Cleans up unused images and volumes to optimize resource usage.
4. **Volume Management**
    - Creates and validates resource volumes needed for container execution.

[VolumeManger](ResourceManager%2014ca27e6386580f29d4df8319b2b677b/VolumeManger%2014ca27e6386580c7ab6bdd6512471e36.md)

[ImageManager](ResourceManager%2014ca27e6386580f29d4df8319b2b677b/ImageManager%2014ca27e63865800887ede58e4e17754c.md)