import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { Position, UserRole, UserStatus } from '../src/generated/prisma/enums';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

interface TeamData {
  pflId: number;
  name: string;
  shortName: string;
  city?: string;
  badgeUrl: string;
  pflUrl: string;
}

interface PlayerData {
  pflId: number;
  firstName: string;
  lastName: string;
  displayName: string;
  jerseyNumber: number | null;
  position: 'gk' | 'def' | 'mid' | 'fwd';
  price: string;
  photoUrl: string | null;
  teamPflId: number;
  teamShortName: string;
  teamName: string;
}

async function main() {
  console.log('🌱 Початок сидування бази даних Fantasy PFL...\n');

  // 1. Створення користувачів (Admin та Test User)
  console.log('👤 [1/4] Сидування користувачів...');
  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash('Admin12345!', saltRounds);
  const userPasswordHash = await bcrypt.hash('User12345!', saltRounds);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fantasypfl.ua' },
    update: {
      role: UserRole.admin,
      status: UserStatus.active,
    },
    create: {
      email: 'admin@fantasypfl.ua',
      passwordHash: adminPasswordHash,
      role: UserRole.admin,
      status: UserStatus.active,
    },
  });
  console.log(`  ✓ Адміністратор: ${admin.email} (пароль: Admin12345!)`);

  const testUser = await prisma.user.upsert({
    where: { email: 'user@fantasypfl.ua' },
    update: {
      role: UserRole.user,
      status: UserStatus.active,
    },
    create: {
      email: 'user@fantasypfl.ua',
      passwordHash: userPasswordHash,
      role: UserRole.user,
      status: UserStatus.active,
    },
  });
  console.log(`  ✓ Тестовий гравець: ${testUser.email} (пароль: User12345!)`);

  // 2. Сидування команд з teams.json
  console.log('\n🛡️ [2/4] Сидування команд...');
  const teamsPath = path.resolve(__dirname, 'data/teams.json');
  if (!fs.existsSync(teamsPath)) {
    throw new Error('Файл prisma/data/teams.json не знайдено. Запустіть `npm run scrape:teams`');
  }

  const teamsData: TeamData[] = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));
  const teamMapByShortName = new Map<string, string>();
  const teamMapByName = new Map<string, string>();

  for (const t of teamsData) {
    const team = await prisma.team.upsert({
      where: { name: t.name },
      update: {
        shortName: t.shortName,
        badgeUrl: t.badgeUrl,
      },
      create: {
        name: t.name,
        shortName: t.shortName,
        badgeUrl: t.badgeUrl,
      },
    });

    teamMapByShortName.set(t.shortName, team.id);
    teamMapByName.set(t.name, team.id);
  }
  console.log(`  ✓ Успішно збережено команд: ${teamsData.length}`);

  // 3. Сидування гравців з players.json
  console.log('\n⚽ [3/4] Сидування гравців...');
  const playersPath = path.resolve(__dirname, 'data/players.json');
  if (!fs.existsSync(playersPath)) {
    throw new Error('Файл prisma/data/players.json не знайдено. Запустіть `npm run scrape:players`');
  }

  const playersData: PlayerData[] = JSON.parse(fs.readFileSync(playersPath, 'utf-8'));

  // Отримуємо всіх існуючих гравців для ідемпотентності
  const existingPlayers = await prisma.player.findMany({
    select: { id: true, firstName: true, lastName: true, teamId: true },
  });
  const existingPlayerMap = new Map<string, string>();
  for (const ep of existingPlayers) {
    existingPlayerMap.set(`${ep.teamId}_${ep.lastName}_${ep.firstName}`, ep.id);
  }

  let createdPlayersCount = 0;
  let updatedPlayersCount = 0;

  for (const p of playersData) {
    const teamId = teamMapByShortName.get(p.teamShortName) || teamMapByName.get(p.teamName);
    if (!teamId) {
      console.warn(`  ⚠️ Не знайдено команду для гравця: ${p.displayName} (${p.teamName})`);
      continue;
    }

    const key = `${teamId}_${p.lastName}_${p.firstName}`;
    const existingId = existingPlayerMap.get(key);

    const positionEnum = Position[p.position] || Position.mid;

    if (existingId) {
      await prisma.player.update({
        where: { id: existingId },
        data: {
          displayName: p.displayName,
          jerseyNumber: p.jerseyNumber,
          position: positionEnum,
          price: p.price,
          photoUrl: p.photoUrl,
        },
      });
      updatedPlayersCount++;
    } else {
      await prisma.player.create({
        data: {
          firstName: p.firstName,
          lastName: p.lastName,
          displayName: p.displayName,
          jerseyNumber: p.jerseyNumber,
          position: positionEnum,
          price: p.price,
          photoUrl: p.photoUrl,
          teamId,
        },
      });
      createdPlayersCount++;
    }
  }
  console.log(
    `  ✓ Гравців додано: ${createdPlayersCount}, оновлено: ${updatedPlayersCount} (всього оброблено: ${playersData.length})`,
  );

  // 4. Сидування календарних турів (Gameweeks)
  console.log('\n📅 [4/4] Сидування турів чемпіонату (Gameweeks)...');
  const TOTAL_GAMEWEEKS = 18;
  const now = new Date();

  // 1-й тур розпочався 14 днів тому, 2-й тур 7 днів тому, 3-й тур через кілька днів (активний)
  const baseStartDate = new Date(now);
  baseStartDate.setDate(now.getDate() - 14);
  baseStartDate.setHours(12, 0, 0, 0);

  for (let num = 1; num <= TOTAL_GAMEWEEKS; num++) {
    const deadline = new Date(baseStartDate);
    deadline.setDate(baseStartDate.getDate() + (num - 1) * 7);
    deadline.setHours(13, 0, 0, 0);

    // Перші 2 тури позначаємо як завершені для можливості тестування історії
    const isFinished = deadline.getTime() < now.getTime() - 2 * 24 * 60 * 60 * 1000;

    await prisma.gameweek.upsert({
      where: { number: num },
      update: {
        deadline,
        isFinished,
      },
      create: {
        number: num,
        deadline,
        isFinished,
      },
    });
  }
  console.log(`  ✓ Створено ${TOTAL_GAMEWEEKS} турів чемпіонату з розкладом дедлайнів.`);

  console.log('\n✨ Сидування успішно завершено!');
}

main()
  .catch((e) => {
    console.error('❌ Помилка під час сидування:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
