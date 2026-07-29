const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const envs = await prisma.environment.findMany({
    include: {
      createdBy: { select: { id: true, displayName: true, avatarColor: true } },
      project: { select: { name: true } },
      allowedUsers: { select: { id: true, displayName: true, avatarColor: true } },
      _count: { select: { variables: true } }
    }
  });
  console.dir(envs, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());
