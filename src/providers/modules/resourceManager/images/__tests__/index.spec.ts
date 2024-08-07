import fs from 'fs';
import { LowSync } from 'lowdb/lib';

import { createImageManager } from '..';
import { NodeDb } from '../../../../BasicProvider';
import { DB } from '../../../db';
import {
  CorrectedImageInfo,
  DockerodeMock,
} from '../../../../../tests/MockDockerode';
import Logger from '../../../logger';

jest.mock('fs');
jest.useFakeTimers().setSystemTime(new Date('2024-06-10'));

const initial_db_images = {
  'docker.io/ubuntu': {
    lastUsed: new Date('2024-06-08'),
    usage: 1,
    required: false,
  },
  'registry.hub.docker.com/nosana/stats:v1.0.4': {
    lastUsed: new Date('2024-07-09T14:50:58.800Z'),
    usage: 1,
    required: true,
  },
};

const setup = (images: string[] = [], setInitialDB = true) => {
  const mock_dockerode = new DockerodeMock(images);
  const mock_db: LowSync<NodeDb> = new DB('').db;
  const mock_logger: Logger = new Logger();

  if (setInitialDB) {
    mock_db.data.resources.images = { ...initial_db_images };
    mock_db.write();
  }

  return { mock_db, mock_dockerode, mock_logger };
};

describe('createImageManager', () => {
  beforeAll(() => {
    (fs.mkdirSync as jest.Mock).mockImplementation(jest.fn());
  });

  describe('resyncImagesDB', () => {
    // TODO: Fix test
    it.skip('should sync images db on creation and return helper functions', async () => {
      const { mock_db, mock_dockerode, mock_logger } = setup([
        'registry.hub.docker.com/nosana/stats:v1.0.4',
      ]);
      expect(mock_db.data.resources.images).toEqual(initial_db_images);

      const im = createImageManager(mock_db, mock_dockerode, mock_logger);
      await im.resyncImagesDB();

      expect(mock_db.data.resources.images).toEqual({
        'registry.hub.docker.com/nosana/stats:v1.0.4': {
          lastUsed: new Date('2024-07-09T14:50:58.800Z'),
          usage: 1,
          required: true,
        },
      });

      expect(im.setImage).toBeDefined();
    });

    // TODO: fix test
    it.skip('should only remove none required expired images from db and docker', async () => {
      const { mock_db, mock_dockerode, mock_logger } = setup([
        'docker.io/ubuntu',
        'registry.hub.docker.com/nosana/stats:v1.0.4',
      ]);

      let dockerImages = await mock_dockerode.listImages();

      expect(mock_db.data.resources.images).toEqual(initial_db_images);

      expect(dockerImages.map((x) => (x as CorrectedImageInfo).Names)).toEqual([
        ['docker.io/ubuntu'],
        ['registry.hub.docker.com/nosana/stats:v1.0.4'],
      ]);

      const im = createImageManager(mock_db, mock_dockerode, mock_logger);
      await im.resyncImagesDB();

      dockerImages = await mock_dockerode.listImages();

      expect(dockerImages.map((x) => (x as CorrectedImageInfo).Names)).toEqual([
        ['registry.hub.docker.com/nosana/stats:v1.0.4'],
      ]);
    });
  });

  describe('setImage', () => {
    test('when image is not in db, should create new db record', () => {
      const { mock_db, mock_dockerode, mock_logger } = setup(
        ['registry.hub.docker.com/nosana/stats:v1.0.4'],
        false,
      );

      const im = createImageManager(mock_db, mock_dockerode, mock_logger);

      expect(mock_db.data.resources.images).toEqual({});

      im.setImage('ubuntu');

      expect(mock_db.data.resources.images).toEqual({
        ubuntu: { lastUsed: new Date('2024-06-10'), usage: 1, required: false },
      });
    });

    test('when image is in db, should update image usage and last used', () => {
      const { mock_db, mock_dockerode, mock_logger } = setup(
        ['registry.hub.docker.com/nosana/stats:v1.0.4'],
        false,
      );

      mock_db.data.resources.images = {
        ubuntu: { lastUsed: new Date('2024-06-10'), usage: 1, required: false },
      };
      mock_db.write();

      const im = createImageManager(mock_db, mock_dockerode, mock_logger);
      expect(mock_db.data.resources.images).toEqual({
        ubuntu: { lastUsed: new Date('2024-06-10'), usage: 1, required: false },
      });

      jest.useFakeTimers().setSystemTime(new Date('2024-06-11'));

      im.setImage('ubuntu');

      expect(mock_db.data.resources.images).toEqual({
        ubuntu: { lastUsed: new Date('2024-06-11'), usage: 2, required: false },
      });
    });
  });
});
