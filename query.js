const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { userId: '92398102-54fc-40ec-8875-8d67466fc241' }
  });
  console.log(JSON.stringify(projects, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
