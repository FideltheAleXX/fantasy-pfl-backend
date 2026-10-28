import * as fs from 'fs';
import * as path from 'path';

interface PflTeamStanding {
  teamId: number;
  team: string;
  logo: string;
  position: string;
  points: string;
}

export interface ScrapedTeam {
  pflId: number;
  name: string;
  shortName: string;
  city?: string;
  badgeUrl: string;
  pflUrl: string;
}

// Словник канонічних назв та абревіатур для клубів
const TEAM_CONFIGS: Record<
  number,
  { name: string; shortName: string; city: string }
> = {
  1534: { name: 'Вікторія', shortName: 'ВІК', city: 'Суми' },
  1499: { name: 'СК Полтава', shortName: 'ПОЛ', city: 'Полтава' },
  1531: { name: 'Фенікс-Маріуполь', shortName: 'ФНК', city: 'Маріуполь' },
  1524: { name: 'Агробізнес', shortName: 'АГР', city: 'Волочиськ' },
  1194: { name: 'Олександрія-2', shortName: 'ОЛЕ', city: 'Олександрія' },
  1568: { name: 'Куликів-Білка', shortName: 'КУЛ', city: 'Куликів' },
  1170: { name: 'Нива Тернопіль', shortName: 'НИВ', city: 'Тернопіль' },
  1554: { name: 'Локомотив Київ', shortName: 'ЛОК', city: 'Київ' },
  1007: { name: 'Інгулець', shortName: 'ІНГ', city: 'Петрове' },
  1238: {
    name: 'Прикарпаття-Благо',
    shortName: 'ПРК',
    city: 'Івано-Франківськ',
  },
  1493: { name: 'Металіст', shortName: 'МЕТ', city: 'Харків' },
  1557: { name: 'ЮКСА', shortName: 'ЮКС', city: 'Тарасівка' },
  1562: { name: 'Колос-2', shortName: 'КОЛ', city: 'Ковалівка' },
  1532: { name: 'ФК Чернігів', shortName: 'ЧЕР', city: 'Чернігів' },
  1241: { name: 'Пробій', shortName: 'ПРБ', city: 'Городенка' },
  1498: { name: 'Полісся-2', shortName: 'ПЛ2', city: 'Житомир' },
};

function formatFallbackName(rawName: string): string {
  return rawName
    .toLowerCase()
    .split(/[- ]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
}

async function scrapeTeams(): Promise<void> {
  console.log('📡 Отримання списку команд Першої ліги з pfl.ua...');

  const PFL_STANDINGS_URL = 'https://pfl.ua/standing-json-tv/1';
  const response = await fetch(PFL_STANDINGS_URL);

  if (!response.ok) {
    throw new Error(
      `Помилка запиту до pfl.ua: ${response.status} ${response.statusText}`,
    );
  }

  const rawTeams: PflTeamStanding[] = await response.json();
  console.log(`✅ Отримано команд із турнірної таблиці: ${rawTeams.length}`);

  const teams: ScrapedTeam[] = rawTeams.map((item) => {
    const config = TEAM_CONFIGS[item.teamId];

    const name = config?.name || formatFallbackName(item.team);
    const shortName = config?.shortName || item.team.slice(0, 3).toUpperCase();
    const city = config?.city;
    const badgeUrl =
      item.logo || `https://pfl.ua/upload/tv/1/${item.teamId}.png`;
    const pflUrl = `https://pfl.ua/team/view/${item.teamId}`;

    return {
      pflId: item.teamId,
      name,
      shortName,
      city,
      badgeUrl,
      pflUrl,
    };
  });

  const outputDir = path.resolve(__dirname, '../prisma/data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'teams.json');
  fs.writeFileSync(outputPath, JSON.stringify(teams, null, 2), 'utf-8');

  console.log(
    `\n💾 Успішно збережено ${teams.length} команд у файл: ${outputPath}\n`,
  );
  console.table(
    teams.map((t) => ({
      ID: t.pflId,
      Назва: t.name,
      Коротко: t.shortName,
      Місто: t.city,
      Логотип: t.badgeUrl,
    })),
  );
}

scrapeTeams().catch((err) => {
  console.error('❌ Помилка під час скраппінгу команд:', err);
  process.exit(1);
});
