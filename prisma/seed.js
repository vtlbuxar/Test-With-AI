const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding...");

  // 1. Seed System Permissions
  const systemPermissions = [
    { code: 'users:create', description: 'Create system users' },
    { code: 'users:read', description: 'Read system users' },
    { code: 'users:update', description: 'Update system users' },
    { code: 'users:delete', description: 'Delete system users' },
    { code: 'workspaces:create', description: 'Create workspaces' },
    { code: 'workspaces:read', description: 'Read workspaces' },
    { code: 'workspaces:update', description: 'Update workspaces' },
    { code: 'workspaces:delete', description: 'Delete workspaces' },
  ];

  console.log("Seeding system permissions...");
  for (const perm of systemPermissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }

  // 2. Seed System Roles
  const roles = [
    { name: 'SUPER_ADMIN', description: 'Super Administrator with access to everything' },
    { name: 'ADMIN', description: 'System Administrator with user and workspace management capabilities' },
    { name: 'USER', description: 'Standard system user' },
  ];

  console.log("Seeding system roles...");
  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
  }

  // 3. Map System Permissions to Roles
  console.log("Mapping permissions to system roles...");
  const dbPermissions = await prisma.permission.findMany();
  const dbRoles = await prisma.role.findMany();

  const superAdminRole = dbRoles.find(r => r.name === 'SUPER_ADMIN');
  const adminRole = dbRoles.find(r => r.name === 'ADMIN');
  const userRole = dbRoles.find(r => r.name === 'USER');

  // Super Admin gets all permissions
  if (superAdminRole) {
    for (const perm of dbPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: perm.id,
          }
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        }
      });
    }
  }

  // Admin gets all read/update, plus user creation
  if (adminRole) {
    const adminPermissions = dbPermissions.filter(p => 
      p.code.endsWith(':read') || 
      p.code.endsWith(':update') || 
      p.code === 'users:create' ||
      p.code === 'workspaces:create'
    );
    for (const perm of adminPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: perm.id,
          }
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: perm.id,
        }
      });
    }
  }

  // User gets workspace creation and reading
  if (userRole) {
    const userPermissions = dbPermissions.filter(p => 
      p.code === 'workspaces:create' || 
      p.code === 'workspaces:read'
    );
    for (const perm of userPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: userRole.id,
            permissionId: perm.id,
          }
        },
        update: {},
        create: {
          roleId: userRole.id,
          permissionId: perm.id,
        }
      });
    }
  }

  // 4. Seed Workspace Permissions
  const workspacePermissions = [
    { code: 'workspace:update', description: 'Update workspace settings' },
    { code: 'workspace:delete', description: 'Delete workspace' },
    { code: 'members:invite', description: 'Invite members to workspace' },
    { code: 'members:remove', description: 'Remove members from workspace' },
    { code: 'project:create', description: 'Create projects in workspace' },
    { code: 'project:read', description: 'Read projects in workspace' },
    { code: 'project:update', description: 'Update projects in workspace' },
    { code: 'project:delete', description: 'Delete projects in workspace' },
  ];

  console.log("Seeding workspace permissions...");
  for (const wPerm of workspacePermissions) {
    await prisma.workspacePermission.upsert({
      where: { code: wPerm.code },
      update: { description: wPerm.description },
      create: wPerm,
    });
  }

  // 5. Seed default demo data if users exist
  const firstUser = await prisma.user.findFirst();
  if (firstUser) {
    console.log(`Found user ${firstUser.email}. Seeding demo workspace and projects...`);

    // Create a demo workspace
    const demoWorkspace = await prisma.workspace.upsert({
      where: { slug: 'demo-workspace' },
      update: {},
      create: {
        name: 'Demo Workspace',
        slug: 'demo-workspace',
        ownerId: firstUser.id,
      }
    });

    // Create system roles for the workspace if they don't exist
    const ownerWorkspaceRole = await prisma.workspaceRole.upsert({
      where: {
        workspaceId_name: {
          workspaceId: demoWorkspace.id,
          name: 'OWNER',
        }
      },
      update: {},
      create: {
        workspaceId: demoWorkspace.id,
        name: 'OWNER',
        description: 'Workspace owner with full root control',
        isSystem: true,
      }
    });

    // Create a demo project
    const demoProject = await prisma.project.create({
      data: {
        name: 'Demo Test Suite Project',
        description: 'An AI-powered test scenario project for testing requirement uploads.',
        userId: firstUser.id,
        workspaceId: demoWorkspace.id,
        requirementText: 'This is a sample project to analyze the application requirements.',
      }
    });

    console.log(`Created demo project: ${demoProject.name}`);

    // Seed project settings
    await prisma.projectSettings.create({
      data: {
        projectId: demoProject.id,
        defaultModel: 'groq:llama-3.1-8b-instant',
        enableAutoAnalysis: true,
        retentionDays: 30,
      }
    });

    // Seed default project tags
    await prisma.projectTag.createMany({
      data: [
        { projectId: demoProject.id, name: 'Critical Path', color: '#EF4444' },
        { projectId: demoProject.id, name: 'Q3 Release', color: '#3B82F6' },
        { projectId: demoProject.id, name: 'Beta Features', color: '#10B981' },
      ]
    });

    // Seed default requirement labels for the project
    await prisma.requirementLabel.createMany({
      data: [
        { projectId: demoProject.id, name: 'Frontend UI', color: '#8B5CF6' },
        { projectId: demoProject.id, name: 'API Schema', color: '#F59E0B' },
        { projectId: demoProject.id, name: 'Database Audit', color: '#EC4899' },
        { projectId: demoProject.id, name: 'Security Focus', color: '#06B6D4' },
      ]
    });

    console.log("Demo tags and labels seeded successfully!");
  } else {
    console.log("No users found to seed demo projects. Seeding only roles/permissions.");
  }

  console.log("Database seeding completed successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
