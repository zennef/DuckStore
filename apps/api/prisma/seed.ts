import { Color, PrismaClient, Size } from '@prisma/client';

const prisma = new PrismaClient();

// The 7 ducks shown in the spec mockup, with their mockup IDs.
const ducks = [
  { id: 1, color: Color.Red, size: Size.Large, price: 20, quantity: 1800 },
  { id: 2, color: Color.Green, size: Size.Large, price: 20, quantity: 2000 },
  { id: 3, color: Color.Yellow, size: Size.Medium, price: 15, quantity: 800 },
  { id: 4, color: Color.Black, size: Size.Medium, price: 15, quantity: 950 },
  { id: 5, color: Color.Green, size: Size.Small, price: 10, quantity: 600 },
  { id: 6, color: Color.Yellow, size: Size.XLarge, price: 25, quantity: 5000 },
  { id: 7, color: Color.Red, size: Size.XSmall, price: 8, quantity: 300 },
];

async function main() {
  // Upsert by id so the seed can be re-run without duplicating rows.
  for (const duck of ducks) {
    await prisma.duck.upsert({
      where: { id: duck.id },
      update: { ...duck, deleted: false },
      create: duck,
    });
  }
  console.log(`Seeded ${ducks.length} ducks.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
