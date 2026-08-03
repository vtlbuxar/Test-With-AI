-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('MANUAL', 'AUTOMATED', 'CANNOT_BE_AUTOMATED');

-- CreateEnum
CREATE TYPE "SuiteType" AS ENUM ('SMOKE', 'REGRESSION', 'SANITY', 'API', 'PERFORMANCE', 'SECURITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PASSED', 'FAILED', 'BLOCKED', 'SKIPPED', 'PENDING');

-- CreateTable
CREATE TABLE "test_scenarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "scenario_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "test_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_scenario_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scenario_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID,
    "atomic_requirement_id" UUID,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_scenario_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_tag_mappings" (
    "scenario_version_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "scenario_tag_mappings_pkey" PRIMARY KEY ("scenario_version_id","tag_id")
);

-- CreateTable
CREATE TABLE "scenario_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scenario_version_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "scenario_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "test_case_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_case_id" UUID NOT NULL,
    "scenario_version_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "preconditions" TEXT,
    "postconditions" TEXT,
    "priority" "Priority" NOT NULL,
    "severity" "Severity" NOT NULL,
    "estimated_time_minutes" INTEGER,
    "automation_status" "AutomationStatus" NOT NULL,
    "reviewer_id" UUID,
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_case_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_case_version_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "expected_result" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_case_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_case_version_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_case_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_case_version_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_case_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_case_version_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comments" TEXT,

    CONSTRAINT "test_case_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_case_id" UUID NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "change_type" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_case_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "SuiteType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suite_memberships" (
    "suite_id" UUID NOT NULL,
    "test_case_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_suite_memberships_pkey" PRIMARY KEY ("suite_id","test_case_id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "suite_id" UUID,
    "name" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_executions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "test_case_version_id" UUID NOT NULL,
    "tester_id" UUID,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "actual_result" TEXT,
    "execution_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_scenarios_project_id_scenario_code_key" ON "test_scenarios"("project_id", "scenario_code");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_categories_project_id_name_key" ON "scenario_categories"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_tags_project_id_name_key" ON "scenario_tags"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "test_scenario_versions_scenario_id_version_number_key" ON "test_scenario_versions"("scenario_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_project_id_test_case_code_key" ON "test_cases"("project_id", "test_case_code");

-- CreateIndex
CREATE UNIQUE INDEX "test_case_versions_test_case_id_version_number_key" ON "test_case_versions"("test_case_id", "version_number");

-- AddForeignKey
ALTER TABLE "test_scenarios" ADD CONSTRAINT "test_scenarios_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_categories" ADD CONSTRAINT "scenario_categories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_tags" ADD CONSTRAINT "scenario_tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_scenario_versions" ADD CONSTRAINT "test_scenario_versions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "test_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_scenario_versions" ADD CONSTRAINT "test_scenario_versions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "scenario_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_scenario_versions" ADD CONSTRAINT "test_scenario_versions_atomic_requirement_id_fkey" FOREIGN KEY ("atomic_requirement_id") REFERENCES "atomic_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_scenario_versions" ADD CONSTRAINT "test_scenario_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_tag_mappings" ADD CONSTRAINT "scenario_tag_mappings_scenario_version_id_fkey" FOREIGN KEY ("scenario_version_id") REFERENCES "test_scenario_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_tag_mappings" ADD CONSTRAINT "scenario_tag_mappings_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "scenario_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_comments" ADD CONSTRAINT "scenario_comments_scenario_version_id_fkey" FOREIGN KEY ("scenario_version_id") REFERENCES "test_scenario_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_comments" ADD CONSTRAINT "scenario_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_versions" ADD CONSTRAINT "test_case_versions_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_versions" ADD CONSTRAINT "test_case_versions_scenario_version_id_fkey" FOREIGN KEY ("scenario_version_id") REFERENCES "test_scenario_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_versions" ADD CONSTRAINT "test_case_versions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_versions" ADD CONSTRAINT "test_case_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_steps" ADD CONSTRAINT "test_case_steps_test_case_version_id_fkey" FOREIGN KEY ("test_case_version_id") REFERENCES "test_case_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_attachments" ADD CONSTRAINT "test_case_attachments_test_case_version_id_fkey" FOREIGN KEY ("test_case_version_id") REFERENCES "test_case_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_attachments" ADD CONSTRAINT "test_case_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_comments" ADD CONSTRAINT "test_case_comments_test_case_version_id_fkey" FOREIGN KEY ("test_case_version_id") REFERENCES "test_case_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_comments" ADD CONSTRAINT "test_case_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_approvals" ADD CONSTRAINT "test_case_approvals_test_case_version_id_fkey" FOREIGN KEY ("test_case_version_id") REFERENCES "test_case_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_approvals" ADD CONSTRAINT "test_case_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_histories" ADD CONSTRAINT "test_case_histories_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_histories" ADD CONSTRAINT "test_case_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suite_memberships" ADD CONSTRAINT "test_suite_memberships_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suite_memberships" ADD CONSTRAINT "test_suite_memberships_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "test_suites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_executions" ADD CONSTRAINT "test_executions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_executions" ADD CONSTRAINT "test_executions_test_case_version_id_fkey" FOREIGN KEY ("test_case_version_id") REFERENCES "test_case_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_executions" ADD CONSTRAINT "test_executions_tester_id_fkey" FOREIGN KEY ("tester_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
