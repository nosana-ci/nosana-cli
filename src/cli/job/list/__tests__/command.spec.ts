import { Command } from 'commander';
import { listJobsCommand } from '../command';
import { listJobs } from '../action';

vi.mock('../action', () => ({
  listJobs: vi.fn(),
}));

describe('listJobsCommand', () => {
  const mockListAction = vi.fn();
  const parseArgs = ['node', 'list'];

  beforeEach(() => {
    mockListAction.mockReset();
    (listJobs as any).mockImplementation(mockListAction);
  });

  it('should call listJobs action', () => {
    listJobsCommand.parse(parseArgs);
    expect(mockListAction).toHaveBeenCalledTimes(1);
  });

  it('should have 17 options', () => {
    expect(listJobsCommand.options.length).toBe(17);
  });

  it.each([
    ['--limit', undefined],
    ['--offset', undefined],
    ['--state', undefined],
    ['--market', undefined],
    ['--node', undefined],
    ['--poster', undefined],
    ['--payer', undefined],
    ['--time-start', undefined],
    ['--time-end', undefined],
    ['--group-by', undefined],
    ['--time-series-interval', undefined],
    ['--use-multiplier', undefined],
    ['--skip-cache', undefined],
    ['--network', '-n'],
    ['--wallet', '-w'],
    ['--rpc', undefined],
    ['--format', undefined],
  ])('should have %s option', (long, short) => {
    const option = listJobsCommand.options.find((o) => o.long === long);
    expect(option?.long).toBe(long);
    expect(option?.short).toBe(short);
  });

  it('should pass --state to action', () => {
    listJobsCommand.parse([...parseArgs, '--state', 'COMPLETED']);
    expect(mockListAction).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'COMPLETED' }),
      expect.any(Command),
    );
  });

  it('should parse --limit as a number', () => {
    listJobsCommand.parse([...parseArgs, '--limit', '10']);
    expect(mockListAction).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
      expect.any(Command),
    );
  });

  it('should parse --offset as a number', () => {
    listJobsCommand.parse([...parseArgs, '--offset', '20']);
    expect(mockListAction).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 20 }),
      expect.any(Command),
    );
  });

  it('should pass --market to action', () => {
    listJobsCommand.parse([...parseArgs, '--market', 'marketAddress123']);
    expect(mockListAction).toHaveBeenCalledWith(
      expect.objectContaining({ market: 'marketAddress123' }),
      expect.any(Command),
    );
  });

  it('should pass --poster to action', () => {
    listJobsCommand.parse([...parseArgs, '--poster', 'posterAddress123']);
    expect(mockListAction).toHaveBeenCalledWith(
      expect.objectContaining({ poster: 'posterAddress123' }),
      expect.any(Command),
    );
  });

  it('should parse --time-start as a number', () => {
    listJobsCommand.parse([...parseArgs, '--time-start', '1700000000']);
    expect(mockListAction).toHaveBeenCalledWith(
      expect.objectContaining({ timeStart: 1700000000 }),
      expect.any(Command),
    );
  });

  it('should parse --time-end as a number', () => {
    listJobsCommand.parse([...parseArgs, '--time-end', '1750000000']);
    expect(mockListAction).toHaveBeenCalledWith(
      expect.objectContaining({ timeEnd: 1750000000 }),
      expect.any(Command),
    );
  });

  it('should pass --network to action', () => {
    listJobsCommand.parse([...parseArgs, '--network', 'devnet']);
    expect(mockListAction).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'devnet' }),
      expect.any(Command),
    );
  });

  it('should pass --format to action', () => {
    listJobsCommand.parse([...parseArgs, '--format', 'json']);
    expect(mockListAction).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'json' }),
      expect.any(Command),
    );
  });
});
