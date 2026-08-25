import {
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const createHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
      }),
    };

    return { host, status, json };
  };

  it('preserves the status and response of an expected HttpException', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = createHost();
    const exception = new BadRequestException({
      message: 'Invalid request',
      code: 'INVALID_REQUEST',
    });

    filter.catch(exception, host as never);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      message: 'Invalid request',
      code: 'INVALID_REQUEST',
    });
  });

  it('logs unknown errors and returns a generic response without internal details', () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const filter = new AllExceptionsFilter();
    const { host, status, json } = createHost();
    const exception = new Error('database password should not be exposed');

    filter.catch(exception, host as never);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain(
      'database password',
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('stack');
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('database password should not be exposed'),
      exception.stack,
    );

    logError.mockRestore();
  });
});
