import * as fs from 'fs';
import * as path from 'path';

interface TeamJson {
  pflId: number;
  name: string;
  shortName: string;
  city?: string;
  badgeUrl: string;
  pflUrl: string;
}

export type PlayerPosition = 'gk' | 'def' | 'mid' | 'fwd';

export interface ScrapedPlayer {
  pflId: number;
  firstName: string;
  lastName: string;
  displayName: string;
  jerseyNumber: number | null;
  position: PlayerPosition;
  price: string;
  photoUrl: string | null;
  teamPflId: number;
  teamShortName: string;
  teamName: string;
}

function mapPosition(rawPos: string): PlayerPosition {
  const normalized = rawPos.trim().toLowerCase();
  if (normalized.includes('ворот')) return 'gk';
  if (normalized.includes('півзахис')) return 'mid';
  if (normalized.includes('захис')) return 'def';
  if (normalized.includes('напад')) return 'fwd';
  return 'mid';
}

function getDefaultPrice(position: PlayerPosition): string {
  switch (position) {
    case 'gk':
      return '4.5';
    case 'def':
      return '4.5';
    case 'mid':
      return '5.0';
    case 'fwd':
      return '5.5';
    default:
      return '4.5';
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapePlayers(): Promise<void> {
  const teamsPath = path.resolve(__dirname, '../prisma/data/teams.json');
  if (!fs.existsSync(teamsPath)) {
    throw new Error(
      'Файл teams.json не знайдено. Спочатку запустіть `npm run scrape:teams`',
    );
  }

  const teams: TeamJson[] = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));
  console.log(`📋 Завантажено ${teams.length} команд для отримання складів.`);

  const allPlayers: ScrapedPlayer[] = [];
  const statsByTeam: Record<string, number> = {};

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    console.log(
      `\n⏳ [${i + 1}/${teams.length}] Завантаження складу: ${team.name} (${team.pflUrl})...`,
    );

    try {
      const response = await fetch(team.pflUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        console.warn(
          `⚠️ Не вдалося отримати сторінку команди ${team.name}: ${response.status}`,
        );
        continue;
      }

      const html = await response.text();
      const cards = html.split('<div class="card my-1 border-0 card-player"');

      let teamPlayersCount = 0;

      for (let j = 1; j < cards.length; j++) {
        const card = cards[j];

        const href = card.match(/data-href="\/player\/view\/(\d+)"/);
        const pflId = href ? parseInt(href[1], 10) : 0;

        const lastNameRaw = card.match(
          /<p class="card-text m-0 fw-bold">([^<]+)<\/p>/,
        )?.[1];
        const firstNameRaw = card.match(
          /<p class="card-text m-0">([^<]+)<\/p>/,
        )?.[1];

        if (!lastNameRaw || !firstNameRaw) continue;

        const lastName = lastNameRaw.trim();
        const firstNameParts = firstNameRaw.trim().split(/\s+/);
        const firstName = firstNameParts[0];

        const displayName = `${firstName.charAt(0)}. ${lastName}`;

        const numberMatch = card.match(
          /<div class="col-auto text-success text-center">([^<]+)<\/div>/,
        );
        const jerseyNumber = numberMatch
          ? parseInt(numberMatch[1].trim(), 10) || null
          : null;

        const posMatch = card.match(
          /<div class="col text-center small">([^<]+)<\/div>/,
        );
        const position = mapPosition(posMatch ? posMatch[1] : 'Півзахисник');

        const imgMatch = card.match(/<img[^>]+src="([^"]+)"/);
        let photoUrl: string | null = null;
        if (
          imgMatch &&
          imgMatch[1] &&
          !imgMatch[1].includes('default') &&
          !imgMatch[1].includes('no-photo')
        ) {
          photoUrl = imgMatch[1].startsWith('http')
            ? imgMatch[1]
            : `https://pfl.ua${imgMatch[1]}`;
        }

        const price = getDefaultPrice(position);

        allPlayers.push({
          pflId,
          firstName,
          lastName,
          displayName,
          jerseyNumber,
          position,
          price,
          photoUrl,
          teamPflId: team.pflId,
          teamShortName: team.shortName,
          teamName: team.name,
        });

        teamPlayersCount++;
      }

      statsByTeam[team.name] = teamPlayersCount;
      console.log(`✅ ${team.name}: додано ${teamPlayersCount} гравців.`);

      await sleep(250);
    } catch (err: any) {
      console.error(`❌ Помилка під час обробки ${team.name}:`, err.message);
    }
  }

  const outputPath = path.resolve(__dirname, '../prisma/data/players.json');
  fs.writeFileSync(outputPath, JSON.stringify(allPlayers, null, 2), 'utf-8');

  console.log(
    `\n🎉 Скраппінг завершено! Всього спарсено гравців: ${allPlayers.length}`,
  );
  console.log(`💾 Збережено у файл: ${outputPath}\n`);

  console.log('📊 Статистика за позиціями:');
  const posCounts = {
    Воротарі: allPlayers.filter((p) => p.position === 'gk').length,
    Захисники: allPlayers.filter((p) => p.position === 'def').length,
    Півзахисники: allPlayers.filter((p) => p.position === 'mid').length,
    Нападники: allPlayers.filter((p) => p.position === 'fwd').length,
  };
  console.table(posCounts);

  console.log('\n📊 Кількість гравців по клубах:');
  console.table(statsByTeam);
}

scrapePlayers().catch((err) => {
  console.error('❌ Фатальна помилка під час скраппінгу гравців:', err);
  process.exit(1);
});
