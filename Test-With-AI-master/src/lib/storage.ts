export type Project = {
  id: string;
  userId?: string;
  createdAt: string | number | Date;
  requirementText: string;
  analysis?: any;
  scenarios?: any;
  testCases?: any;
  rtm?: any;
  suites?: any;
  versions?: any[];
};

export const storage = {
  getProjects: async (): Promise<Project[]> => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return [];
      const data = await res.json();
      return data.projects || [];
    } catch (e) {
      console.error("Failed to fetch projects", e);
      return [];
    }
  },

  getProject: async (id: string): Promise<Project | undefined> => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return undefined;
      const data = await res.json();
      const projects: Project[] = data.projects || [];
      return projects.find(p => p.id === id);
    } catch (e) {
      console.error("Failed to fetch project", e);
      return undefined;
    }
  },

  saveProject: async (project: Project): Promise<void> => {
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });
    } catch (e) {
      console.error("Failed to save project", e);
    }
  },

  deleteProject: async (id: string): Promise<void> => {
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error("Failed to delete project", e);
    }
  },

  updateArtifact: async (projectId: string, requirementText: string, artifactKey: keyof Project, data: any): Promise<string> => {
    let idToUse = projectId;
    let existingProject: Project | undefined;
    
    if (idToUse) {
      existingProject = await storage.getProject(idToUse);
    }

    if (!existingProject) {
      idToUse = projectId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2));
      existingProject = {
        id: idToUse,
        createdAt: new Date().toISOString(),
        requirementText,
        versions: []
      };
    } else {
      if (existingProject.requirementText !== requirementText) {
        const snapshot = {
          timestamp: new Date().toISOString(),
          requirementText: existingProject.requirementText,
          analysis: existingProject.analysis,
          scenarios: existingProject.scenarios,
          testCases: existingProject.testCases,
          rtm: existingProject.rtm,
          suites: existingProject.suites,
        };
        existingProject.versions = existingProject.versions || [];
        existingProject.versions.push(snapshot);
      }
      existingProject.requirementText = requirementText;
    }

    (existingProject as any)[artifactKey] = data;
    await storage.saveProject(existingProject);

    return existingProject.id;
  }
};
