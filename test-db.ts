import { prisma } from "./lib/prisma";

async function main() {
  try {
    // Get all tables
    const tables: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log("Tables in database:");
    console.log(tables.map(t => t.table_name));

    // Check columns in Student table
    const studentColumns: any[] = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'Student'
    `;
    console.log("\nColumns in Student table:");
    console.log(studentColumns.map(c => `${c.column_name} (${c.data_type})`));

    // Check contents of _prisma_migrations table if it exists
    const migrations: any[] = await prisma.$queryRaw`
      SELECT id, migration_name, applied_steps_count 
      FROM _prisma_migrations
    `.catch(() => []);
    console.log("\nApplied migrations in _prisma_migrations:");
    console.log(migrations);

  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
