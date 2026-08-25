import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Prisma,
  PrismaClient,
  Role,
} from '../src/generated/prisma/client';

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required to bootstrap the first ADMIN.`);
  }

  return value;
}

function validateAdminInput(): {
  email: string;
  name: string;
  password: string;
} {
  const email = requiredEnvironmentValue('ADMIN_EMAIL').trim().toLowerCase();
  const name = requiredEnvironmentValue('ADMIN_NAME').trim();
  const password = requiredEnvironmentValue('ADMIN_PASSWORD');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }
  if (!name) {
    throw new Error('ADMIN_NAME must not be empty.');
  }
  if (!password.trim()) {
    throw new Error('ADMIN_PASSWORD must not be empty.');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must be at most 72 bytes for bcrypt.');
  }

  return { email, name, password };
}

async function main(): Promise<void> {
  const databaseUrl = requiredEnvironmentValue('DATABASE_URL').trim();
  const { email, name, password } = validateAdminInput();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const existingAdmin = await transaction.user.findFirst({
          where: { role: Role.ADMIN },
          select: { id: true },
        });

        if (existingAdmin) {
          return 'skipped' as const;
        }

        const existingUser = await transaction.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (existingUser) {
          throw new Error(
            'ADMIN_EMAIL belongs to an existing user; no changes were made.',
          );
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await transaction.user.create({
          data: {
            email,
            passwordHash,
            name,
            role: Role.ADMIN,
          },
          select: { id: true },
        });

        return 'created' as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result === 'created') {
      console.log('First ADMIN user created.');
    } else {
      console.log('An ADMIN user already exists; no changes made.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  console.error('First ADMIN bootstrap failed.');
  process.exitCode = 1;
});
