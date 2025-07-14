import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { UserProjects, UserProjectsInstance } from "./ProjectModel";
import { Status } from "./Status";
import { ModelTraining } from "./ModelTraining";

export interface UserDB {
  id: number;
  name: string;
  username: string;
  email: string;
}

export const User = types
  .model({
    id: types.optional(types.identifierNumber, -1),
    name: types.optional(types.string, "Guest"),
    username: types.optional(types.string, "Guest"),
    email: types.optional(types.string, ""),
    userProjects: types.optional(UserProjects, {}),
    status: types.maybe(Status),
    modelTraining: types.optional(ModelTraining, {}),
  })
  .views((self) => ({
    get isGuest() {
      return self.id < 0;
    },
  }))
  .actions((self) => ({
    setUserProjects(userProjects: UserProjectsInstance) {
      self.userProjects = userProjects;
    },
    setName(name: string) {
      self.name = name;
    },
    setUsername(username: string) {
      self.username = username;
    },
    setEmail(email: string) {
      self.email = email;
    },
  }));

export interface UserInstance extends Instance<typeof User> {}
export interface UserSnapshotIn extends SnapshotIn<typeof User> {}
