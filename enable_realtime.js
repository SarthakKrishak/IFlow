const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Enabling Supabase Realtime for realtime_doc_store...");
    await prisma.$executeRawUnsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE realtime_doc_store;`);
    console.log("Successfully enabled Realtime for realtime_doc_store!");
  } catch (error) {
    if (error.message.includes("does not exist")) {
      console.log("Publication might not exist, creating it...");
      await prisma.$executeRawUnsafe(`CREATE PUBLICATION supabase_realtime FOR TABLE realtime_doc_store;`);
      console.log("Successfully created publication and enabled Realtime!");
    } else {
      console.error("Error enabling Realtime:", error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
