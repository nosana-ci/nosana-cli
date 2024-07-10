import fs from 'fs';

import { DB } from '../../db';
import { createImageManager } from '../';
import { DockerodeMock } from '../../../../tests/MockDockerode';
import { LowSync } from 'lowdb/lib';
import { NodeDb } from '../../../BasicProvider';

jest.mock('fs');
jest.useFakeTimers().setSystemTime(new Date('2024-06-10'));

const initial_db_images = {
  'docker.io/ubuntu': {
    lastUsed: new Date('2024-06-08'),
    usage: 1,
  },
  'registry.hub.docker.com/nosana/stats:v1.0.4': {
    lastUsed: new Date('2024-07-09T14:50:58.800Z'),
    usage: 1,
  },
};

const setup = (images: string[] = [], setInitialDB = true) => {
  const mock_dockerode = new DockerodeMock();
  const mock_db: LowSync<NodeDb> = new DB('').db;

  if (images) {
    for (const img of images) {
      mock_dockerode.addMockImage([img]);
    }
  }

  if (setInitialDB) {
    mock_db.data.images = { ...initial_db_images };
    mock_db.write();
  }

  return { mock_db, mock_dockerode };
};

describe('createImageManager', () => {
  beforeAll(() => {
    (fs.mkdirSync as jest.Mock).mockImplementation(jest.fn());
  });

  it('should sync images db on creation and return helper functions', async () => {
    const { mock_db, mock_dockerode } = setup([
      'registry.hub.docker.com/nosana/stats:v1.0.4',
    ]);
    expect(mock_db.data.images).toEqual(initial_db_images);

    const im = await createImageManager(mock_db, mock_dockerode);

    expect(mock_db.data.images).toEqual({
      'registry.hub.docker.com/nosana/stats:v1.0.4': {
        lastUsed: new Date('2024-07-09T14:50:58.800Z'),
        usage: 1,
      },
    });

    expect(im.removeDanglingImages).toBeDefined();
    expect(im.setImage).toBeDefined();
  });

  describe('setImage', () => {
    test('when image is not in db, should create new db record', () => {
      const { mock_db, mock_dockerode } = setup(
        ['registry.hub.docker.com/nosana/stats:v1.0.4'],
        false,
      );

      const im = createImageManager(mock_db, mock_dockerode);

      expect(mock_db.data.images).toEqual({});

      im.setImage('ubuntu');

      expect(mock_db.data.images).toEqual({
        ubuntu: { lastUsed: new Date('2024-06-10'), usage: 1 },
      });
    });

    test('when image is in db, should update image usage and last used', () => {
      const { mock_db, mock_dockerode } = setup(
        ['registry.hub.docker.com/nosana/stats:v1.0.4'],
        false,
      );

      mock_db.data.images = {
        ubuntu: { lastUsed: new Date('2024-06-10'), usage: 1 },
      };
      mock_db.write();

      const im = createImageManager(mock_db, mock_dockerode);
      expect(mock_db.data.images).toEqual({
        ubuntu: { lastUsed: new Date('2024-06-10'), usage: 1 },
      });

      jest.useFakeTimers().setSystemTime(new Date('2024-06-11'));

      im.setImage('ubuntu');

      expect(mock_db.data.images).toEqual({
        ubuntu: { lastUsed: new Date('2024-06-11'), usage: 2 },
      });
    });
  });

  describe('removeDanglingImages', () => {
    it('should only remove none required expired images from db and docker', async () => {
      const { mock_db, mock_dockerode } = setup([
        'docker.io/ubuntu',
        'registry.hub.docker.com/nosana/stats:v1.0.4',
      ]);

      let dockerImages = await mock_dockerode.listImages();

      expect(mock_db.data.images).toEqual(initial_db_images);

      expect(dockerImages.map((x) => x.Names)).toEqual([
        ['docker.io/ubuntu'],
        ['registry.hub.docker.com/nosana/stats:v1.0.4'],
      ]);

      const im = createImageManager(mock_db, mock_dockerode);
      await im.removeDanglingImages();

      dockerImages = await mock_dockerode.listImages();

      expect(dockerImages.map((x) => x.Names)).toEqual([
        ['registry.hub.docker.com/nosana/stats:v1.0.4'],
      ]);
    });
  });
});
