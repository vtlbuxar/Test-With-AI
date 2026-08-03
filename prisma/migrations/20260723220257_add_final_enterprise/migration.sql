/*
  Warnings:

  - You are about to drop the `acceptance_criteria` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `defect_attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `defect_comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `execution_attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requirement_approvals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requirement_attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requirement_comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requirement_reviews` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `scenario_comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `test_case_approvals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `test_case_attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `test_case_comments` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIAL');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "acceptance_criteria" DROP CONSTRAINT "acceptance_criteria_atomic_requirement_id_fkey";

-- DropForeignKey
ALTER TABLE "defect_attachments" DROP CONSTRAINT "defect_attachments_defect_id_fkey";

-- DropForeignKey
ALTER TABLE "defect_attachments" DROP CONSTRAINT "defect_attachments_uploaded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "defect_comments" DROP CONSTRAINT "defect_comments_defect_id_fkey";

-- DropForeignKey
ALTER TABLE "defect_comments" DROP CONSTRAINT "defect_comments_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "defect_comments" DROP CONSTRAINT "defect_comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "execution_attachments" DROP CONSTRAINT "execution_attachments_execution_id_fkey";

-- DropForeignKey
ALTER TABLE "execution_attachments" DROP CONSTRAINT "execution_attachments_uploaded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_approvals" DROP CONSTRAINT "requirement_approvals_approver_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_approvals" DROP CONSTRAINT "requirement_approvals_version_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_attachments" DROP CONSTRAINT "requirement_attachments_uploaded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_attachments" DROP CONSTRAINT "requirement_attachments_version_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_comments" DROP CONSTRAINT "requirement_comments_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_comments" DROP CONSTRAINT "requirement_comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_comments" DROP CONSTRAINT "requirement_comments_version_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_reviews" DROP CONSTRAINT "requirement_reviews_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_reviews" DROP CONSTRAINT "requirement_reviews_version_id_fkey";

-- DropForeignKey
ALTER TABLE "scenario_comments" DROP CONSTRAINT "scenario_comments_scenario_version_id_fkey";

-- DropForeignKey
ALTER TABLE "scenario_comments" DROP CONSTRAINT "scenario_comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "test_case_approvals" DROP CONSTRAINT "test_case_approvals_approver_id_fkey";

-- DropForeignKey
ALTER TABLE "test_case_approvals" DROP CONSTRAINT "test_case_approvals_test_case_version_id_fkey";

-- DropForeignKey
ALTER TABLE "test_case_attachments" DROP CONSTRAINT "test_case_attachments_test_case_version_id_fkey";

-- DropForeignKey
ALTER TABLE "test_case_attachments" DROP CONSTRAINT "test_case_attachments_uploaded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "test_case_comments" DROP CONSTRAINT "test_case_comments_test_case_version_id_fkey";

-- DropForeignKey
ALTER TABLE "test_case_comments" DROP CONSTRAINT "test_case_comments_user_id_fkey";

-- AlterTable
ALTER TABLE "test_executions" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "started_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "parent_run_id" UUID,
ADD COLUMN     "started_at" TIMESTAMP(3);

-- DropTable
DROP TABLE "acceptance_criteria";

-- DropTable
DROP TABLE "defect_attachments";

-- DropTable
DROP TABLE "defect_comments";

-- DropTable
DROP TABLE "execution_attachments";

-- DropTable
DROP TABLE "requirement_approvals";

-- DropTable
DROP TABLE "requirement_attachments";

-- DropTable
DROP TABLE "requirement_comments";

-- DropTable
DROP TABLE "requirement_reviews";

-- DropTable
DROP TABLE "scenario_comments";

-- DropTable
DROP TABLE "test_case_approvals";

-- DropTable
DROP TABLE "test_case_attachments";

-- DropTable
DROP TABLE "test_case_comments";

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "link_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "in_app_notifications" BOOLEAN NOT NULL DEFAULT true,
    "ai_completed_alerts" BOOLEAN NOT NULL DEFAULT true,
    "defect_assigned_alerts" BOOLEAN NOT NULL DEFAULT true,
    "workspace_activity_alerts" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID,
    "user_id" UUID,
    "action_code" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "format" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_count" INTEGER NOT NULL,
    "file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "import_source" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "error_details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excel_import_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mapping_data" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "excel_import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excel_approval_workflows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "import_history_id" UUID NOT NULL,
    "required_approvals_count" INTEGER NOT NULL DEFAULT 1,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "excel_approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID,
    "requirement_version_id" UUID,
    "test_case_version_id" UUID,
    "approver_id" UUID NOT NULL,
    "status" "ApprovalStatus" NOT NULL,
    "comments" TEXT,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reviewer_id" UUID NOT NULL,
    "status" "ReviewStatus" NOT NULL,
    "feedback" TEXT,
    "requirement_version_id" UUID,
    "test_case_version_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" TEXT NOT NULL,
    "requirement_version_id" UUID,
    "scenario_version_id" UUID,
    "test_case_version_id" UUID,
    "defect_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "requirement_version_id" UUID,
    "test_case_version_id" UUID,
    "execution_id" UUID,
    "defect_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_statistics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "total_requirements_count" INTEGER NOT NULL DEFAULT 0,
    "total_test_cases_count" INTEGER NOT NULL DEFAULT 0,
    "active_defects_count" INTEGER NOT NULL DEFAULT 0,
    "last_run_pass_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_analytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "active_users_count" INTEGER NOT NULL DEFAULT 0,
    "tests_executed_count" INTEGER NOT NULL DEFAULT 0,
    "defects_logged_count" INTEGER NOT NULL DEFAULT 0,
    "ai_tokens_spent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_analytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "active_users_count" INTEGER NOT NULL DEFAULT 0,
    "tests_executed_count" INTEGER NOT NULL DEFAULT 0,
    "defects_logged_count" INTEGER NOT NULL DEFAULT 0,
    "ai_tokens_spent" INTEGER NOT NULL DEFAULT 0,
    "estimated_ai_cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "total_bytes_stored" BIGINT NOT NULL DEFAULT 0,
    "files_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_usages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "actions_count" INTEGER NOT NULL DEFAULT 0,
    "ai_generations_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_usages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "projects_count" INTEGER NOT NULL DEFAULT 0,
    "members_count" INTEGER NOT NULL DEFAULT 0,
    "runs_executed_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_metrics" (
    "project_id" UUID NOT NULL,
    "rtm_coverage_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "automation_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "defect_density" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_metrics_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "base_price_monthly" DOUBLE PRECISION NOT NULL,
    "user_seat_limit" INTEGER NOT NULL,
    "project_limit" INTEGER NOT NULL,
    "ai_token_limit" INTEGER NOT NULL,
    "storage_bytes_limit" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "stripe_subscription_id" TEXT,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_meters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "ai_tokens_used_this_month" INTEGER NOT NULL DEFAULT 0,
    "extra_seats_purchased" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_settings" (
    "workspace_id" UUID NOT NULL,
    "allowed_domains" TEXT[],
    "default_workspace_role_id" UUID,
    "require_mfa" BOOLEAN NOT NULL DEFAULT false,
    "custom_logo_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateTable
CREATE TABLE "system_configurations" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_analytics_project_id_date_key" ON "daily_analytics"("project_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_analytics_project_id_month_year_key" ON "monthly_analytics"("project_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "storage_metrics_workspace_id_key" ON "storage_metrics"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_usages_user_id_key" ON "user_usages"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_usages_workspace_id_key" ON "workspace_usages"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_subscriptions_workspace_id_key" ON "workspace_subscriptions"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_subscriptions_stripe_subscription_id_key" ON "workspace_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_meters_workspace_id_key" ON "usage_meters"("workspace_id");

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_parent_run_id_fkey" FOREIGN KEY ("parent_run_id") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_histories" ADD CONSTRAINT "export_histories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_histories" ADD CONSTRAINT "export_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_histories" ADD CONSTRAINT "import_histories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_histories" ADD CONSTRAINT "import_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excel_import_mappings" ADD CONSTRAINT "excel_import_mappings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excel_import_mappings" ADD CONSTRAINT "excel_import_mappings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excel_approval_workflows" ADD CONSTRAINT "excel_approval_workflows_import_history_id_fkey" FOREIGN KEY ("import_history_id") REFERENCES "import_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_histories" ADD CONSTRAINT "approval_histories_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "excel_approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_histories" ADD CONSTRAINT "approval_histories_requirement_version_id_fkey" FOREIGN KEY ("requirement_version_id") REFERENCES "requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_histories" ADD CONSTRAINT "approval_histories_test_case_version_id_fkey" FOREIGN KEY ("test_case_version_id") REFERENCES "test_case_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_histories" ADD CONSTRAINT "approval_histories_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_histories" ADD CONSTRAINT "review_histories_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_histories" ADD CONSTRAINT "review_histories_requirement_version_id_fkey" FOREIGN KEY ("requirement_version_id") REFERENCES "requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_histories" ADD CONSTRAINT "review_histories_test_case_version_id_fkey" FOREIGN KEY ("test_case_version_id") REFERENCES "test_case_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_requirement_version_id_fkey" FOREIGN KEY ("requirement_version_id") REFERENCES "requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_scenario_version_id_fkey" FOREIGN KEY ("scenario_version_id") REFERENCES "test_scenario_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_test_case_version_id_fkey" FOREIGN KEY ("test_case_version_id") REFERENCES "test_case_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_defect_id_fkey" FOREIGN KEY ("defect_id") REFERENCES "defects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_requirement_version_id_fkey" FOREIGN KEY ("requirement_version_id") REFERENCES "requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_test_case_version_id_fkey" FOREIGN KEY ("test_case_version_id") REFERENCES "test_case_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "test_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_defect_id_fkey" FOREIGN KEY ("defect_id") REFERENCES "defects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_statistics" ADD CONSTRAINT "dashboard_statistics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_analytics" ADD CONSTRAINT "daily_analytics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_analytics" ADD CONSTRAINT "monthly_analytics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_metrics" ADD CONSTRAINT "storage_metrics_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_usages" ADD CONSTRAINT "user_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_usages" ADD CONSTRAINT "workspace_usages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_metrics" ADD CONSTRAINT "project_metrics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
