export class LogMonitoringRegistry {
  private static instance: LogMonitoringRegistry;
  private registry: Map<string, any> = new Map();

  public static getInstance(): LogMonitoringRegistry {
    if (!LogMonitoringRegistry.instance) {
      LogMonitoringRegistry.instance = new LogMonitoringRegistry();
    }
    return LogMonitoringRegistry.instance;
  }

  public setLoggable(state: boolean) {
    this.registry.set('loggable', state);
  }

  public getLoggable(): boolean {
    return this.registry.get('loggable') ?? true;
  }

  public setSkipLog(state: boolean) {
    this.registry.set('skiplog', state) ?? true;
  }

  public getSkipLog(): boolean {
    return this.registry.get('skiplog') ?? false;
  }
}