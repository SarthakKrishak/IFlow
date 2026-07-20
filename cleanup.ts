import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const allowedNames = ['Sarthak Krishak', 'Kamal', 'Anurag', 'Aditya'];
  const users = await prisma.user.findMany();
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  
  for (const user of users) {
    if (!allowedNames.includes(user.displayName)) {
      console.log(`Deleting user: ${user.displayName}`);
      
      // Delete activity logs
      await prisma.activityLog.deleteMany({ where: { userId: user.id } });
      
      // Update tickets
      await prisma.ticket.updateMany({ where: { createdById: user.id }, data: { createdById: admin!.id } });
      await prisma.ticket.updateMany({ where: { assigneeId: user.id }, data: { assigneeId: null } });

      // Delete user
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
  console.log("Cleanup complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
