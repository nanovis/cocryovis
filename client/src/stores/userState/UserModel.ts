import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { UserProjects, UserProjectsInstance } from "./ProjectModel";
import { Status } from "./Status";
import { ModelTraining } from "./ModelTraining";
import z from "zod";
import { publicUser } from "#schemas/user-path-schema.mjs";

export type UserDB = z.infer<typeof publicUser>

export const User = types
  .model({
    id: types.optional(types.identifierNumber, -1),
    name: types.optional(types.string, "Guest"),
    username: types.optional(types.string, "Guest"),
    email: types.optional(types.string, ""),
    admin: types.optional(types.boolean, false),
    userProjects: types.optional(UserProjects, {}),
    status: types.maybe(Status),
    modelTraining: types.optional(ModelTraining, {}),
  })
  .volatile(() => ({
    changePasswordActiveRequest: false,
    deleteUserActiveRequset: false,
  }))
  .views((self) => ({
    get isGuest() {
      return self.id < 0;
    },
  }))

  .actions((self) => ({
    setChangePasswordActiveRequest(active: boolean) {
      self.changePasswordActiveRequest = active;
    },
    setDeleteUserActiveRequset(active: boolean) {
      self.deleteUserActiveRequset = active;
    },
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
