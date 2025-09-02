import { flow, Instance, isAlive, types } from "mobx-state-tree";
import { User, UserDB } from "./userState/UserModel";
import { createContext, useContext } from "react";
import Cookies from "js-cookie";
import { UiState } from "./uiState/UiState";
import * as Api from "../api/users";

const CookieName = "LoggedUser";

const RootStore = types
  .model({
    user: types.optional(User, {}),
    uiState: types.optional(UiState, {}),
    wasmLoaded: types.optional(types.boolean, false),
  })
  .volatile(() => ({
    reloadingSession: false,
    triedReloadingSession: false,
    setingUpUser: false,
  }))

  .views((self) => ({
    // get isAdminPanelOpen() {
    //   return self.uiState.openAdminPanel && self.user.isAdmin
    // }
    get pageDisabled() {
      return (
        self.reloadingSession ||
        self.setingUpUser ||
        self.uiState.isSignInOrSignUpInProgress
      );
    },
  }))
  .actions((self) => ({
    setReloadingSession(loading: boolean) {
      self.reloadingSession = loading;
    },
    setTriedReloadingSession(loading: boolean) {
      self.triedReloadingSession = loading;
    },

    setWasmLoaded(loaded: boolean) {
      self.wasmLoaded = loaded;
    },
    login: flow(function* login(userData: UserDB) {
      try {
        self.setingUpUser = true;
        self.uiState.visualizedVolume = undefined;
        self.user = User.create({
          ...userData,
          userProjects: {},
          status: {},
        });
        const expirationTime = new Date(new Date().getTime() + 60 * 1000 * 24);
        Cookies.set(CookieName, JSON.stringify(userData), {
          expires: expirationTime,
        });
        yield self.user.userProjects.fetchProjects();
        if (!isAlive(self)) {
          return;
        }
        if (self.user.status) {
          yield self.user.status.fetchStatus();
          if (!isAlive(self)) {
            return;
          }
        }
        self.uiState.setOpenSignUpPage(false);
        self.uiState.setOpenSignInPage(false);
      } finally {
        self.setingUpUser = false;
      }
    }),

    logout: flow(function* logout() {
      yield Api.logout();
      if (!isAlive(self)) {
        return;
      }
      self.user = User.create({});
      self.uiState.visualizedVolume = undefined;
      Cookies.remove(CookieName);
      window.location.reload();
    }),
  }));

const initialState = RootStore.create({});

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
