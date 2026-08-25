import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a lightweight ok response', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });

  it('marks the endpoint as public and skipped by throttling', () => {
    const endpointMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      HealthController.prototype.getHealth,
    );
    const metadataKeys = Reflect.getMetadataKeys(
      HealthController.prototype.getHealth,
    ).map(String);

    expect(endpointMetadata).toBe(true);
    expect(metadataKeys.some((key) => key.startsWith('THROTTLER:SKIP'))).toBe(
      true,
    );
  });
});
