const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('iflow123', 12);
  
  await prisma.user.updateMany({
    data: {
      passwordHash: hash,
      isActive: true,
      mustChangePassword: false, // Don't force them to change it immediately for testing
    }
  });

  console.log('All passwords reset to iflow123');
}

main().finally(() => prisma.$disconnect());
