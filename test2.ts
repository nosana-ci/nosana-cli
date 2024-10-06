import Dockerode from 'dockerode';

const docker = new Dockerode({
  host: 'localhost',
  port: '8080',
  protocol: 'http',
});

const container = await docker.getContainer('32322478c084');

console.log(new Date());

const buffer = await container.logs({
  follow: false,
  stdout: true,
  stderr: true,
});

const demuxOutput = (buffer: Buffer): any[] => {
  const output: any[] = [];

  function bufferSlice(end: number) {
    const out = buffer.slice(0, end);
    buffer = Buffer.from(buffer.slice(end, buffer.length));
    return out;
  }

  while (buffer.length > 0) {
    const header = bufferSlice(8);
    const nextDataType = header.readUInt8(0);
    const nextDataLength = header.readUInt32BE(4);
    const content = bufferSlice(nextDataLength);
    switch (nextDataType) {
      case 1:
        output.push({
          type: 'stdout',
          log: Buffer.concat([content]).toString('utf8'),
        });
        break;
      case 2:
        output.push({
          type: 'stderr',
          log: Buffer.concat([content]).toString('utf8'),
        });
        break;
      default:
      // ignore
    }
  }

  return output;
};

const res = demuxOutput(buffer);
console.log(res[res.length - 1]);
console.log(new Date());
