# JobExternalUtil

`JobExternalUtil.ts`

**`JobExternalUtil`**: Handles external job-related utilities such as resolving job definitions and results using strategies. this util uses `JobDefinitionStrategy` and `ResultReturnStrategy` to resolve external definitions and results

### **JobDefinitionStrategy and JobDefinitionStrategySelector**

### **JobDefinitionStrategy**

`JobDefinitionStrategy` is an interface that defines the structure for strategies that resolve job definitions. It provides a method for fetching or resolving job definitions based on specific contexts, such as API listeners or other mechanisms.

- **Method**:
    - `load(jobId: string): Promise<JobDefinition>`Ensures that job definitions can be dynamically fetched or resolved depending on the context.
- **Use Case**:
This strategy is designed to enable modular handling of job definitions, allowing the implementation to vary depending on the scenario, such as resolving job definitions from a database, an API, or a predefined in-memory store.

### **JobDefinitionStrategySelector**

`JobDefinitionStrategySelector` is responsible for dynamically selecting the appropriate `JobDefinitionStrategy` implementation. This selector allows the system to adapt to different scenarios by identifying and instantiating the correct strategy.

- **Purpose**:
It provides a mechanism to dynamically determine the appropriate strategy (e.g., `api-listen` or other implementations) for loading job definitions.

### **ResultReturnStrategy and ResultReturnStrategySelector**

### **ResultReturnStrategy**

`ResultReturnStrategy` is an interface that focuses on the submission of job results. It provides a method for dynamically submitting results based on the context or requirements of the job.

- **Method**:
    - `load(jobId: string): Promise<boolean>`Ensures that results can be submitted dynamically, accommodating varying job requirements or execution environments.
- **Use Case**:
This strategy allows flexibility in handling the return or submission of job results. For example, job results might be sent to a remote API, stored in a database, or handled in a custom way.

### **ResultReturnStrategySelector**

`ResultReturnStrategySelector` is responsible for dynamically selecting the appropriate `ResultReturnStrategy` implementation. Similar to its counterpart for job definitions, this selector adapts to different contexts to instantiate the correct strategy.

- **Purpose**:
It identifies and instantiates the appropriate strategy for result submission (e.g., based on the type of job or its execution context).