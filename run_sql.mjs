// 일회성 DB 마이그레이션 스크립트 (Prisma migrate가 ESM 충돌로 안 돌아갈 때 우회용).
// 실행: node --env-file=.env run_sql.mjs
import pg from 'pg';

if (!process.env.DIRECT_URL) {
  console.error('DIRECT_URL 환경변수가 필요합니다. .env 확인 후 다음처럼 실행: node --env-file=.env run_sql.mjs');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();

const queries = [
  `CREATE TABLE IF NOT EXISTS "LessonStep" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "aiName" TEXT NOT NULL DEFAULT 'AI 학생',
    "aiAvatar" TEXT NOT NULL DEFAULT 'default',
    "aiPersonality" TEXT NOT NULL DEFAULT 'curious',
    "aiFocus" TEXT,
    "completionCriteria" TEXT,
    "minMessages" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonStep_pkey" PRIMARY KEY ("id")
  )`,
  `DO $$ BEGIN
    ALTER TABLE "LessonStep" ADD CONSTRAINT "LessonStep_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS "StepProgress" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StepProgress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StepProgress_instanceId_stepId_key" UNIQUE ("instanceId", "stepId")
  )`,
  `DO $$ BEGIN
    ALTER TABLE "StepProgress" ADD CONSTRAINT "StepProgress_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "AIInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "StepProgress" ADD CONSTRAINT "StepProgress_stepId_fkey"
    FOREIGN KEY ("stepId") REFERENCES "LessonStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "AIInstance" ADD COLUMN IF NOT EXISTS "currentStepId" TEXT`,
  `DO $$ BEGIN
    ALTER TABLE "AIInstance" ADD CONSTRAINT "AIInstance_currentStepId_fkey"
    FOREIGN KEY ("currentStepId") REFERENCES "LessonStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "stepProgressId" TEXT`,
  `DO $$ BEGIN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_stepProgressId_fkey"
    FOREIGN KEY ("stepProgressId") REFERENCES "StepProgress"("id") ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

for (const q of queries) {
  try {
    await client.query(q);
    console.log('OK:', q.split('\n')[0].trim().slice(0, 70));
  } catch (e) {
    console.error('ERR:', e.message.slice(0, 120));
  }
}

await client.end();
console.log('마이그레이션 완료');
