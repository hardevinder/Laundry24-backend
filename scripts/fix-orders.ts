import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.order.updateMany({
    where: { userId: null },
    data: { userId: 2 }, // 👈 replace with your actual logged-in user ID
  });

  console.log(`✅ Updated ${updated.count} old orders to userId=2`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
