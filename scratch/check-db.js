const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const testCases = await prisma.testCase.findMany({
    include: {
      versions: true
    }
  });
  console.log(`Found ${testCases.length} Test Cases:`);
  for (const tc of testCases) {
    console.log(`- [${tc.test_case_id}] ${tc.title}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
