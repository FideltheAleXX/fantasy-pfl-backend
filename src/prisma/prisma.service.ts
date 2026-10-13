import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({ adapter });
  }
}
