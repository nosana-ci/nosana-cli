import { NodeDb, ResourceHistory, VolumeResource } from '../../../providers/modules/db/index.js';
import { LowSync } from 'lowdb';
import { Flow, OpState, FlowState, Log } from '../provider/types.js';

export class NodeRepository {
  constructor(private db: LowSync<NodeDb>) {}

  public getflow(id: string): Flow {
    return this.db.data.flows[id];
  }

  public setflow(id: string, flow: Flow): void {
    this.db.data.flows[id] = flow;
    this.db.write();
  }

  public addOpstate(id: string, opstate: OpState): void {
    this.db.data.flows[id].state.opStates.push(opstate);
    this.db.write();
  }

  public getFlowState(id: string): FlowState {
    return this.db.data.flows[id]?.state;
  }

  public updateflowState(id: string, updatedFields: Partial<FlowState>): void {
    Object.assign(this.db.data.flows[id].state, updatedFields);
    this.db.write();
  }

  public updateflowStateSecret(
    id: string,
    updatedFields: { [key: string]: string },
  ): void {
    if (!this.db.data.flows[id]?.state?.secrets) {
      this.db.data.flows[id].state.secrets = {};
    }

    this.db.data.flows[id].state.secrets = {
      ...this.db.data.flows[id].state.secrets,
      ...updatedFields,
    };
    this.db.write();
  }

  public getFlowSecret(id: string, key: string): string | undefined {
    const secrets = this.db.data.flows[id]?.state?.secrets ?? {};
    return secrets[key];
  }

  public updateflowStateError(id: string, error: Error | unknown): void {
    if (!this.db.data.flows[id]?.state?.errors) {
      this.db.data.flows[id].state.errors = [];
    }

    (this.db.data.flows[id].state.errors as any[]).push(error);
    this.db.write();
  }

  public getOpState(id: string, index: number): OpState {
    return this.db.data.flows[id].state.opStates[index];
  }

  public updateOpState(
    id: string,
    opIndex: number,
    updatedFields: Partial<OpState>,
  ): void {
    Object.assign(
      this.db.data.flows[id].state.opStates[opIndex],
      updatedFields,
    );
    this.db.write();
  }

  public updateOpStateLogs(id: string, opIndex: number, log: Log): void {
    if (!this.db.data.flows[id].state.opStates[opIndex].logs) {
      this.db.data.flows[id].state.opStates[opIndex].logs = [];
    }
    this.db.data.flows[id].state.opStates[opIndex].logs.push(log);
    this.db.write();
  }

  public updateNodeInfo(updatedFields: { [key: string]: string }): void {
    Object.assign(this.db.data.info, updatedFields);
    this.db.write();
  }

  public getNodeInfo(): {
    [key: string]: string;
  } {
    return this.db.data.info;
  }

  public getImagesResources(): { [key: string]: ResourceHistory; } {
    return this.db.data.resources.images;
  }
  
  public getImageResource(image: string): ResourceHistory {
    return this.db.data.resources.images[image];
  }

  public updateImageResource(image: string, updatedFields: { [key: string]: string; }): void {
    Object.assign(this.db.data.resources.images[image], updatedFields);
    this.db.write();
  }

  public deleteImageResource(image: string): void {
    delete this.db.data.resources.images[image];
    this.db.write();
  }

  public getVolumesResources(): { [key: string]: VolumeResource; } {
    return this.db.data.resources.volumes;
  }

  public getVolumeResource(volume: string): VolumeResource {
    return this.db.data.resources.volumes[volume];
  }

  public updateVolumeResource(volume: string, updatedFields: { [key: string]: string; }): void {
    Object.assign(this.db.data.resources.volumes[volume], updatedFields);
    this.db.write();
  }

  public deleteVolumeResource(volume: string): void {
    delete this.db.data.resources.volumes[volume];
    this.db.write();
  }
}
