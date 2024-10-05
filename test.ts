import Dockerode from 'dockerode';

const docker = new Dockerode({
  host: 'localhost',
  port: '8080',
  protocol: 'http',
});

// const container = await docker.getContainer('45ecb8dff6fe');
const container = await docker.getContainer('56e7420d1f59');
// const container = await docker.getContainer('743673af103a');
const info = await container.inspect();

console.log(new Date());

const buffer = await container.logs({
  follow: false,
  stdout: true,
  stderr: true,
});

console.log(buffer);

let startVal = 0;

buffer.forEach((val, ind, buf) => {
  const header = buf.slice(0, 8);
  // console.log({ header });
  // const chunkType = header.readUInt8(0);
  // console.log({ chunkType });
  // const chunkLength = header.readUInt32BE(4);
  // console.log({ chunkLength });
  console.log(buf.toString());
});
// console.log(chunk);
// const header = buffer.subarray(startVal, 8);
// console.log('header');
// console.log(header);
// const chunkDataType = header.readUInt8(0);
// console.log('chunkDataType');
// console.log(chunkDataType);
// const chunkDataLength = header.readUInt32BE(4);
// console.log('chunkDataLength');
// console.log(chunkDataLength);
// startVal += 8 + chunkDataLength;
// const content = buffer.subarray(val - 1, chunkDataLength);

// console.log(content.toString('utf-8'));
// }
