export class NodeAbortController {
  private controller: AbortController | undefined;

  constructor() {}

  public getController(): AbortController {
    if (!this.controller) {
      this.controller = new AbortController();
    }
    return this.controller;
  }

  public refresh() {
    this.controller = undefined;
  }
}
