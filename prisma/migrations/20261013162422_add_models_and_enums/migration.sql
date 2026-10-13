-- CreateEnum
CREATE TYPE "Position" AS ENUM ('gk', 'def', 'mid', 'fwd');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('aviable', 'doubtful', 'injured', 'suspended', 'left_league');

-- CreateTable
CREATE TABLE "player" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "photo_url" TEXT,
    "jersey_number" INTEGER,
    "position" "Position" NOT NULL,
    "price" DECIMAL(4,1) NOT NULL,
    "status" "PlayerStatus" NOT NULL DEFAULT 'aviable',
    "status_description" TEXT,
    "chance_of_playing" INTEGER DEFAULT 100,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "form" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "selected_by_percent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "badge_url" TEXT,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_gameweek_stat" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "gameweek_id" TEXT NOT NULL,
    "minutes_played" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "clean_sheet" BOOLEAN NOT NULL DEFAULT false,
    "goals_conceded" INTEGER NOT NULL DEFAULT 0,
    "yellow_cards" INTEGER NOT NULL DEFAULT 0,
    "red_cards" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_gameweek_stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gameweek" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "is_finished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "gameweek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fantasy_team_pick" (
    "id" TEXT NOT NULL,
    "fantasy_team_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "is_captain" BOOLEAN NOT NULL DEFAULT false,
    "is_vice_captain" BOOLEAN NOT NULL DEFAULT false,
    "is_bench" BOOLEAN NOT NULL DEFAULT false,
    "order_number" INTEGER NOT NULL,

    CONSTRAINT "fantasy_team_pick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_team_id_idx" ON "player"("team_id");

-- CreateIndex
CREATE INDEX "player_position_idx" ON "player"("position");

-- CreateIndex
CREATE UNIQUE INDEX "team_name_key" ON "team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "player_gameweek_stat_player_id_gameweek_id_key" ON "player_gameweek_stat"("player_id", "gameweek_id");

-- CreateIndex
CREATE UNIQUE INDEX "gameweek_number_key" ON "gameweek"("number");

-- CreateIndex
CREATE INDEX "fantasy_team_pick_fantasy_team_id_idx" ON "fantasy_team_pick"("fantasy_team_id");

-- CreateIndex
CREATE INDEX "fantasy_team_pick_player_id_idx" ON "fantasy_team_pick"("player_id");

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_gameweek_stat" ADD CONSTRAINT "player_gameweek_stat_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_gameweek_stat" ADD CONSTRAINT "player_gameweek_stat_gameweek_id_fkey" FOREIGN KEY ("gameweek_id") REFERENCES "gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_team_pick" ADD CONSTRAINT "fantasy_team_pick_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
