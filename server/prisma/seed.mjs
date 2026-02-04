import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    // await prisma.user.upsert({
    //     where: { username: 'ciril' },
    //     update: {},
    //     create: {
    //         name: 'Ciril Bohak',
    //         username: 'ciril',
    //         email: 'ciril.bohak@gmail.com',
    //         passwordSalt: "yk4ZvEhIKBqo59vZSAShveWvE83YEDxEuTulbXud3QrTp+d22cWJ5nQmp32UKE0xylI5qw3UnBTquNdvsGAazw==",
    //         passwordHash: "nnyqAZ5oZS2OdyleIlL2YyVLdnxQETwpfLtIPxDgkB8AeN13OfN70qk5PQmTOKS7XeNLIviDk08bFCAVHGFAA0K2cN9bwRZHZ/uBSeXWR+016KXeiTOGfVxBfoKcTAlZVUT3TMQeVq43UnwQ/7shqa8Y2deD/RXU2pF+2iEjvA4="
    //     },
    // })
    //     await prisma.bytesPerVoxel.createMany({
    //         data: [
    //             { id: 1, name: "1" },
    //             { id: 2, name: "2" },
    //             { id: 4, name: "4" },
    //             { id: 8, name: "8" },
    //         ],
    //     });
    //     await prisma.usedBits.createMany({
    //         data: [
    //             { id: 8, name: "8" },
    //             { id: 16, name: "16" },
    //             { id: 32, name: "32" },
    //             { id: 64, name: "64" },
    //         ],
    //     });
    //     console.log("Seeding done!");
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
