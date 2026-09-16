import { PrismaClient } from '@prisma/client';

export async function cleanDatabase(prisma: PrismaClient) {
  // el orden importa: primero lo que depende de otra tabla,
  // al final lo que nadie más referencia
  await prisma.inspection.deleteMany();
  await prisma.client.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.user.deleteMany();
}