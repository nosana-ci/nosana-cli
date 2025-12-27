import {
  NodeDb,
  ResourceHistory,
  VolumeResource,
} from '../../../providers/modules/db/index.js';
import { LowSync } from 'lowdb';
import { Flow, OpState, FlowState } from '@nosana/sdk';

type OpStateError = {
  event: string;
  message: string;
  code?: number;
};

// OpState with error field (until SDK is updated)
type OpStateWithError = OpState & {
  error: OpStateError[];
};

const MAX_LOGS = 24999;

export class NodeRepository {
  constructor(private db: LowSync<NodeDb>) {}

  public getFlow(id: string): Flow {
    return this.db.data.flows[id];
  }

  public getFlows(): { [key: string]: Flow } {
    return this.db.data.flows;
  }

  public setflow(id: string, flow: Flow): void {
    this.db.data.flows[id] = flow;
    this.db.write();
  }

  public deleteflow(id: string): void {
    delete this.db.data.flows[id];
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
    updatedFields: { [key: string]: any },
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

  public getFlowSecret(id: string, key: string): any | undefined {
    const secrets = this.db.data.flows[id]?.state?.secrets ?? {};
    return secrets[key];
  }

  public updateflowStateError(
    id: string,
    {
      status,
      error,
    }: {
      status?: string;
      error: Error | unknown;
    },
  ): void {
    if (!this.db.data.flows[id]?.state)
      throw new Error('Failed to find flow state.');

    if (status) {
      this.db.data.flows[id].state.status = status;
    }

    if (!this.db.data.flows[id].state.errors) {
      this.db.data.flows[id].state.errors = [];
    }

    (this.db.data.flows[id].state.errors as any[]).push(
      error instanceof Error ? error.message : error,
    );

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

  public updateOpStateLogs(id: string, opIndex: number, log: any): void {
    const logs = this.db.data.flows[id].state.opStates[opIndex].logs;

    if (!logs) {
      this.db.data.flows[id].state.opStates[opIndex].logs = [log];
    } else {
      // Trim if already at max capacity
      if (logs.length >= MAX_LOGS) {
        logs.shift(); // Remove the oldest log
      }
      logs.push(log);
    }

    this.db.write();
  }

  public updateOpStateError(
    id: string,
    opIndex: number,
    error: OpStateError,
  ): void {
    const opState = this.db.data.flows[id].state.opStates[
      opIndex
    ] as OpStateWithError;
    if (!opState.error) {
      opState.error = [];
    }

    opState.error.push(error);
    this.db.write();
  }

  public updateNodeInfo(updatedFields: Partial<NodeDb['info']>): void {
    Object.assign(this.db.data.info, updatedFields);
    this.db.write();
  }

  public getNodeInfo(): NodeDb['info'] {
    return this.db.data.info;
  }

  public getImagesResources(): { [key: string]: ResourceHistory } {
    return this.db.data.resources.images;
  }

  public getImageResource(image: string): ResourceHistory {
    return this.db.data.resources.images[image];
  }

  public createImageResource(image: string, fields: ResourceHistory): void {
    this.db.data.resources.images[image] = fields;
    this.db.write();
  }

  public updateImageResource(
    image: string,
    updatedFields: Partial<ResourceHistory> | ResourceHistory,
  ): void {
    if (!this.db.data.resources.images[image]) {
      this.createImageResource(image, updatedFields as ResourceHistory);
    }
    Object.assign(this.db.data.resources.images[image], updatedFields);
    this.db.write();
  }

  public deleteImageResource(image: string): void {
    delete this.db.data.resources.images[image];
    this.db.write();
  }

  public getVolumesResources(): { [key: string]: VolumeResource } {
    return this.db.data.resources.volumes;
  }

  public getVolumeResource(volume: string): VolumeResource {
    return this.db.data.resources.volumes[volume];
  }

  public createVolumeResource(volume: string, fields: VolumeResource): void {
    this.db.data.resources.volumes[volume] = fields;
    this.db.write();
  }

  public updateVolumeResource(
    volume: string,
    updatedFields: Partial<VolumeResource> | VolumeResource,
  ): void {
    if (!this.db.data.resources.volumes[volume]) {
      this.createVolumeResource(volume, updatedFields as VolumeResource);
    }
    Object.assign(this.db.data.resources.volumes[volume], updatedFields);
    this.db.write();
  }

  public deleteVolumeResource(volume: string): void {
    delete this.db.data.resources.volumes[volume];
    this.db.write();
  }

  public displayLog(log: string) {
    return log;
  }

  public getFlowOperationName(id: string, index: number): string {
    if (this.db.data.flows[id]) {
      return this.db.data.flows[id].jobDefinition.ops[index].id;
    }

    return 'null';
  }
}
