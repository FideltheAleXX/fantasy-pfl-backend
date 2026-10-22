-- CreateTable
CREATE TABLE "fantasy_team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bank" DECIMAL(5,1) NOT NULL DEFAULT 100.0,
    "team_value" DECIMAL(5,1) NOT NULL DEFAULT 100.0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "overall_rank" INTEGER,
    "free_transfers" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fantasy_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fantasy_team_gameweek" (
    "id" TEXT NOT NULL,
    "fantasy_team_id" TEXT NOT NULL,
    "gameweek_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "points_on_bench" INTEGER NOT NULL DEFAULT 0,
    "transfers_made" INTEGER NOT NULL DEFAULT 0,
    "transfers_cost" INTEGER NOT NULL DEFAULT 0,
    "net_points" INTEGER NOT NULL DEFAULT 0,
    "gameweek_rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fantasy_team_gameweek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fantasy_team_user_id_key" ON "fantasy_team"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fantasy_team_gameweek_fantasy_team_id_gameweek_id_key" ON "fantasy_team_gameweek"("fantasy_team_id", "gameweek_id");

-- AddForeignKey
ALTER TABLE "fantasy_team_pick" ADD CONSTRAINT "fantasy_team_pick_fantasy_team_id_fkey" FOREIGN KEY ("fantasy_team_id") REFERENCES "fantasy_team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_team" ADD CONSTRAINT "fantasy_team_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_team_gameweek" ADD CONSTRAINT "fantasy_team_gameweek_fantasy_team_id_fkey" FOREIGN KEY ("fantasy_team_id") REFERENCES "fantasy_team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_team_gameweek" ADD CONSTRAINT "fantasy_team_gameweek_gameweek_id_fkey" FOREIGN KEY ("gameweek_id") REFERENCES "gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
