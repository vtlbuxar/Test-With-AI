-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REQUESTED_CHANGES', 'COMMENTED');

-- CreateEnum
CREATE TYPE "UploadSource" AS ENUM ('FILE_UPLOAD', 'MANUAL_INPUT', 'JIRA_SYNC', 'CONFLUENCE');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "workspace_id" UUID;

-- CreateTable
CREATE TABLE "project_settings" (
    "project_id" UUID NOT NULL,
    "default_model" TEXT,
    "enable_auto_analysis" BOOLEAN NOT NULL DEFAULT false,
    "retention_days" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_settings_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "project_statistics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "total_requirements" INTEGER NOT NULL DEFAULT 0,
    "total_versions" INTEGER NOT NULL DEFAULT 0,
    "total_analyses" INTEGER NOT NULL DEFAULT 0,
    "ai_tokens_consumed" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirement_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "folder_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "requirement_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "raw_requirement" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "upload_source" "UploadSource" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL,
    "parent_id" UUID,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "requirement_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirement_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comments" TEXT,

    CONSTRAINT "requirement_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_labels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_document_labels" (
    "document_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,

    CONSTRAINT "requirement_document_labels_pkey" PRIMARY KEY ("document_id","label_id")
);

-- CreateTable
CREATE TABLE "requirement_metadata" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "requirement_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_tags_project_id_name_key" ON "project_tags"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_folders_project_id_parent_id_name_key" ON "requirement_folders"("project_id", "parent_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_versions_document_id_version_number_key" ON "requirement_versions"("document_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_labels_project_id_name_key" ON "requirement_labels"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_metadata_version_id_key_key" ON "requirement_metadata"("version_id", "key");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_statistics" ADD CONSTRAINT "project_statistics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_folders" ADD CONSTRAINT "requirement_folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_folders" ADD CONSTRAINT "requirement_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "requirement_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_documents" ADD CONSTRAINT "requirement_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_documents" ADD CONSTRAINT "requirement_documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "requirement_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "requirement_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_attachments" ADD CONSTRAINT "requirement_attachments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_attachments" ADD CONSTRAINT "requirement_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_comments" ADD CONSTRAINT "requirement_comments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_comments" ADD CONSTRAINT "requirement_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "requirement_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_comments" ADD CONSTRAINT "requirement_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_reviews" ADD CONSTRAINT "requirement_reviews_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_reviews" ADD CONSTRAINT "requirement_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_approvals" ADD CONSTRAINT "requirement_approvals_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_approvals" ADD CONSTRAINT "requirement_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_labels" ADD CONSTRAINT "requirement_labels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_document_labels" ADD CONSTRAINT "requirement_document_labels_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "requirement_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_document_labels" ADD CONSTRAINT "requirement_document_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "requirement_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_metadata" ADD CONSTRAINT "requirement_metadata_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
