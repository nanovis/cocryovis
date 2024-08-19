import path from "path";
import fs from 'fs';

if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./db.sqlite';
}

if (!fs.existsSync(path.resolve(import.meta.dirname, '.env'))) {
    fs.writeFileSync(
        path.resolve(import.meta.dirname, '.env'),
        `DATABASE_URL=${process.env.DATABASE_URL}\n`
    );
}