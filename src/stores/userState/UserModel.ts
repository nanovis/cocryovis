import { Instance, SnapshotIn, types, flow } from "mobx-state-tree";
import { UserProjects, UserProjectsInstance } from "./ProjectModel";
import { Status } from "./Status";

export interface UserDB {
  id: number;
  name: string;
  username: string;
  email: string;
}

export const User = types
  .model({
    id: types.identifierNumber,
    name: types.string,
    username: types.string,
    email: types.string,
    userProjects: UserProjects,
    status: Status,
  })
  .actions((self) => ({
    async setUserProjects(userProjects: UserProjectsInstance) {
      self.userProjects = userProjects;
    },
  }));

export interface UserInstance extends Instance<typeof User> {}
export interface UserSnapshotIn extends SnapshotIn<typeof User> {}
