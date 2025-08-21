import { flow, getParent, Instance, isAlive, types } from "mobx-state-tree";
import { ModelDB, ProjectModels } from "./ModelModel";
import { ProjectVolumes, VolumeDB } from "./VolumeModel";
import * as Utils from "../../utils/Helpers";
import { toast } from "react-toastify";
import { projectSchema } from "#schemas/componentSchemas/project-schema.mjs";
import z from "zod";
import {
  projectSchemaDeepRes,
  projectsSchemaDeepRes,
} from "#schemas/project-path-schema.mjs";
import * as ProjectApi from "../../api/projects";

interface ProjectDB {
  id: number;
  name: string;
  description: string;
  ownerId: number;
  publicAccess: number;
  accessLevel: number;
  volumes: VolumeDB[];
  models: ModelDB[];
}

export const Project = types
  .model({
    id: types.identifierNumber,
    name: types.string,
    description: types.string,
    ownerId: types.integer,
    accessLevel: types.integer,
    publicAccess: types.integer,
    projectVolumes: ProjectVolumes,
    projectModels: ProjectModels,
  })
  .views((self) => ({
    get user() {
      return getParent(self, 2);
    },
    get hasWriteAccess() {
      return self.accessLevel >= 1;
    },
  }))
  .actions((self) => ({
    setPublicAccess(accessLevel: number) {
      self.publicAccess = accessLevel;
    },
    getProjectUrl() {
      return `${window.location.origin}/project/${self.id}`;
    },
  }));

export interface ProjectInstance extends Instance<typeof Project> {}

export const UserProjects = types
  .model({
    projects: types.map(Project),
    activeProjectId: types.maybe(types.integer),
  })
  .views((self) => ({
    get user() {
      return getParent(self);
    },
    get activeProject() {
      return self.activeProjectId
        ? self.projects.get(self.activeProjectId)
        : undefined;
    },
  }))
  .actions((self) => ({
    clear() {
      self.projects.clear();
      self.activeProjectId = undefined;
    },
    fetchProject: flow(function* fetchProject(id: number) {
      try {
        const project: z.infer<typeof projectSchemaDeepRes> =
          yield ProjectApi.getProjectDeep(id);
        if (!isAlive(self)) {
          return;
        }

        if (!project) {
          throw new Error("Project not found");
        }

        self.projects.set(project.id, {
          ...project,
          projectModels: { projectId: project.id },
          projectVolumes: { projectId: project.id },
        });

        const newProject = self.projects.get(project.id);

        newProject?.projectVolumes.setVolumes(project.volumes);
        newProject?.projectModels.setModels(project.models);
      } catch (error) {
        console.error("Failed to fetch projects", error);
        throw error;
      }
    }),
    fetchProjects: flow(function* fetchProjects() {
      try {
        const projects: z.infer<typeof projectsSchemaDeepRes> =
          yield ProjectApi.getAllUserProjectsDeep();
        if (!isAlive(self)) {
          return;
        }

        self.projects.clear();
        let foundProjectId = false;
        projects.forEach((project: ProjectDB) => {
          self.projects.set(project.id, {
            ...project,
            projectModels: { projectId: project.id },
            projectVolumes: { projectId: project.id },
          });

          const newProject = self.projects.get(project.id);

          newProject?.projectVolumes.setVolumes(project.volumes);
          newProject?.projectModels.setModels(project.models);

          if (self.activeProjectId == project.id) {
            foundProjectId = true;
          }
        });
        if (!foundProjectId) {
          self.activeProjectId = undefined;
        }
      } catch (error) {
        console.error("Failed to fetch projects", error);
      }
    }),
    createProject: flow(function* createProject(
      projectName: string,
      projectDescription: string
    ) {
      try {
        const project: z.infer<typeof projectSchema> =
          yield ProjectApi.createProject({
            name: projectName,
            description: projectDescription,
          });

        if (!isAlive(self)) {
          return;
        }

        console.log(project);

        self.projects.set(project.id, {
          ...project,
          accessLevel: 2,
          projectModels: { projectId: project.id },
          projectVolumes: { projectId: project.id },
        });

        self.activeProjectId = project.id;
      } catch (error) {
        console.error("Failed to fetch projects", error);
      }
    }),
    deleteProject: flow(function* deleteProject(projectId: number) {
      try {
        ProjectApi.deleteProject(projectId);
        self.projects.delete(projectId.toString());
        self.activeProjectId = undefined;
      } catch (error) {
        console.error("Failed to delete project", error);
      }
    }),
  }))
  .actions((self) => ({
    setActiveProject: flow(function* setActiveProject(projectId: number) {
      if (!self.projects.has(projectId)) {
        yield self.fetchProject(projectId);
        if (!isAlive(self)) {
          return;
        }
      }
      self.activeProjectId = projectId;
    }),
    loadDemoProject: flow(function* loadDemoProject() {
      let toastId = null;
      try {
        toastId = toast.loading("Loading demo project...");
        const response = yield Utils.sendReq(
          "demo",
          {
            method: "GET",
          },
          false
        );
        if (!isAlive(self)) {
          return;
        }

        const project: z.infer<typeof projectSchemaDeepRes> =
          yield response.json();
        if (!isAlive(self)) {
          return;
        }

        if (!self.projects.has(project.id)) {
          self.projects.set(project.id, {
            ...project,
            projectModels: { projectId: project.id },
            projectVolumes: { projectId: project.id },
          });

          const newProject = self.projects.get(project.id);

          newProject?.projectVolumes.setVolumes(project.volumes);
          newProject?.projectModels.setModels(project.models);
        }

        toast.update(toastId, {
          render: "Demo project loaded",
          type: "success",
          isLoading: false,
          autoClose: 2000,
        });

        self.activeProjectId = project.id;
      } catch (error) {
        Utils.updateToastWithErrorMsg(toastId, error);
        console.error("Failed to load demo project", error);
      }
    }),
  }));

export interface UserProjectsInstance extends Instance<typeof UserProjects> {}
