# Nosana Node Documentation

## Main Page

### Introduction

This documentation outlines the architecture of the Nosana Node system. The primary objective of this refactor is to break down the Node into modular components, making the system more manageable, scalable, and debuggable. The core of this refactor revolves around the [`NodeManager`](Nosana%20Node%20Documentation%2014aa27e638658070af2ad51b1415f8be/NodeManager%20Class%2014aa27e63865807ea8a2d437dd734c40.md) class, which orchestrates the Node's operations seamlessly.

### Navigation

The documentation is organized into distinct sections, corresponding to the modular structure of the Node system. Each module has its own dedicated page for detailed explanations and implementation specifics. Below is an overview of the directory structure:

```
NodeManager/
├── configs/                 # Configurations and settings for the node
├── monitoring/              # Streaming, logging, and states for the node
├── node/                    # Main node functionality
├── provider/                # Device provider (e.g., Docker, Podman connection)
├── repository/              # Persistent layer for the node
└── index.js                 # Node Manager entry point
```

### Key Sections

Individual pages for each module:

- **Configs**: Environment configurations and settings.
- **Monitoring**: Logging, streaming, and state management.
- **Node**: Core operations and dependencies.
- **Provider**: Device provider integrations.
- **Repository**: Persistent data storage and management.

### Quick Links

[NodeManager Class](Nosana%20Node%20Documentation%2014aa27e638658070af2ad51b1415f8be/NodeManager%20Class%2014aa27e63865807ea8a2d437dd734c40.md)

[Configs Module](Nosana%20Node%20Documentation%2014aa27e638658070af2ad51b1415f8be/Configs%20Module%2014aa27e6386580239141f1918a3778ef.md)

[Monitoring Module](Nosana%20Node%20Documentation%2014aa27e638658070af2ad51b1415f8be/Monitoring%20Module%2014aa27e63865803bb68ef176549599a7.md)

[Node Module](Nosana%20Node%20Documentation%2014aa27e638658070af2ad51b1415f8be/Node%20Module%2014aa27e638658094b454c73748202026.md)

[Provider Module](Nosana%20Node%20Documentation%2014aa27e638658070af2ad51b1415f8be/Provider%20Module%2014aa27e6386580b5a6bef89f2c2a22c9.md)

[Repository Module](Nosana%20Node%20Documentation%2014aa27e638658070af2ad51b1415f8be/Repository%20Module%2014aa27e63865801985c1c8fe3b23bde1.md)

[Node API](Nosana%20Node%20Documentation%2014aa27e638658070af2ad51b1415f8be/Node%20API%2014ba27e63865809fa3a3e9bc0c191979.md)

### Purpose

This documentation serves as a comprehensive guide to understanding the Node's architecture, facilitating development, debugging, and future enhancements. Each section is designed to provide clarity and actionable insights into the Node system's workings.

### Adding New Features and Modules

To maintain consistency and modularity, any new additions to the Node system should follow these guidelines:

1. **Directory Structure**:
    - Place new modules in an appropriate directory or create a new directory under `NodeManager/` if necessary.
    - Ensure the directory name reflects its purpose (e.g., `analytics/` for analytics-related modules).
2. **Documentation**:
    - Add a new subpage for the module in the documentation.
    - Include a clear description of the module's purpose, its integration with the NodeManager, and any dependencies.
3. **Code Structure**:
    - Follow existing patterns for class structure, method naming, and modularization.
    - Include comments and examples to help future developers understand the code.