import { flow, Instance, types } from "mobx-state-tree";
import { User, UserDB } from "./userState/UserModel";
import { createContext, useContext } from "react";
import Cookies from "js-cookie";
import Utils from "../functions/Utils";
import { UiState } from "./uiState/UiState";

const CookieName = "LoggedUser";

const RootStore = types
  .model({
    user: types.maybe(User),
    uiState: UiState,
  })
  .actions((self) => ({
    login(userData: UserDB) {
      self.uiState.visualizedVolume = undefined;
      self.user = User.create({
        ...userData,
        userProjects: { state: "pending" },
        status: {},
      });
      const expirationTime = new Date(new Date().getTime() + 60 * 1000 * 24);
      Cookies.set(CookieName, JSON.stringify(userData), {
        expires: expirationTime,
      });

      self.user.userProjects.fetchProjects();
      self.user.status.fetchStatus();
    },

    logout: flow(function* logout() {
      try {
        yield Utils.sendReq("logout", {
          method: "POST",
        });
        self.user = undefined;
        self.uiState.visualizedVolume = undefined;
        Cookies.remove(CookieName);
        window.location.reload();
      } catch (error) {
        console.error(error);
      }
    }),
  }));

let initialState = RootStore.create({ uiState: {} });

export const rootStore = initialState;

export interface RootInstance extends Instance<typeof RootStore> {}

const RootStoreContext = createContext<null | RootInstance>(null);

export const RootStoreProvider = RootStoreContext.Provider;
export function useMst() {
  const store = useContext(RootStoreContext);
  if (store === null) {
    throw new Error("Store cannot be null, please add a context provider");
  }
  return store;
}
