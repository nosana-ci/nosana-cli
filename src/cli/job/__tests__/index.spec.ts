import { jobCommand } from '../';

jest.mock('../download/action.ts', () => ({
  download: () => 'Download job action',
}));
jest.mock('../get/action.ts', () => ({
  get: () => 'Get job action',
}));
jest.mock('../post/action.ts', () => ({
  post: () => 'Post job action',
}));
jest.mock('../upload/action.ts', () => ({
  upload: () => 'Upload job action',
}));

describe('jobCommand', () => {
  it.each([['download'], ['get'], ['post'], ['upload']])(
    'should contain %s command',
    (command) => {
      // @ts-ignore
      expect(jobCommand.commands.map((command) => command._name)).toContain(
        command,
      );
    },
  );
});
