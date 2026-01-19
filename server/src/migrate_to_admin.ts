import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const admin = await prisma.user.findUnique({
        where: { username: 'admin3078' }
    });

    if (!admin) {
        console.error('Error: User admin3078 not found!');
        return;
    }

    console.log(`Found admin user: ${admin.username} (ID: ${admin.id})`);

    const todoUpdate = await prisma.todo.updateMany({
        data: { userId: admin.id }
    });
    console.log(`Updated ${todoUpdate.count} todos.`);

    const gameUpdate = await prisma.videoGame.updateMany({
        data: { userId: admin.id }
    });
    console.log(`Updated ${gameUpdate.count} video games.`);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
