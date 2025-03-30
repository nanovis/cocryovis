import { Instance, SnapshotIn, types, flow, isAlive } from "mobx-state-tree";
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
    id: types.optional(types.identifierNumber, -1),
    name: types.optional(types.string, "Guest"),
    username: types.optional(types.string, "Guest"),
    email: types.optional(types.string, ""),
    userProjects: types.optional(UserProjects, {}),
    status: types.maybe(Status),
  })
  .views((self) => ({
    get isGuest() {
      return self.id < 0;
    },
  }))
  .actions((self) => ({
    async setUserProjects(userProjects: UserProjectsInstance) {
      self.userProjects = userProjects;
    },
    // login: flow(function* login(userData: UserDB) {
    //   console.log("Login action called with data:", userData);

    //   self.id = userData.id;
    //   self.name = userData.name;
    //   self.username = userData.username;
    //   self.email = userData.email;
    //   self.userProjects.clear();
    //   self.status = Status.create({});

    //   const expirationTime = new Date(new Date().getTime() + 60 * 1000 * 24);
    //   Cookies.set(CookieName, JSON.stringify(userData), {
    //     expires: expirationTime,
    //   });

    //   yield self.userProjects.fetchProjects();
    //   if (!isAlive(self)) {
    //     return;
    //   }
    //   yield self.status.fetchStatus();
    //   if (!isAlive(self)) {
    //     return;
    //   }
    //   console.log("User data after login:", self);
    // }),

    // logout: flow(function* logout() {
    //   try {
    //     yield Utils.sendReq("logout", {
    //       method: "POST",
    //     });
    //     self.id = -1;
    //     self.name = "Guest";
    //     self.username = "Guest";
    //     self.email = "";
    //     self.status = undefined;
    //     self.userProjects.clear();

    //     Cookies.remove(CookieName);
    //     window.location.reload();
    //   } catch (error) {
    //     console.error(error);
    //   }
    // }),
  }));

export interface UserInstance extends Instance<typeof User> {}
export interface UserSnapshotIn extends SnapshotIn<typeof User> {}
