export const JOB_STATE_NAME = {
    PULLING_IMAGE: 'PULLING_IMAGE',
    NONE: 'NONE'
} as const;

export type JobState = (typeof JOB_STATE_NAME)[keyof typeof JOB_STATE_NAME];

export type PullingImageData = {
    node: string;
}

export type NoneData = {}

export type JobStateData = {
    [JOB_STATE_NAME.PULLING_IMAGE]: PullingImageData;
    [JOB_STATE_NAME.NONE]: NoneData;
};
