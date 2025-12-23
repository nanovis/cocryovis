import type { Instance } from "mobx-state-tree";
import { flow, isAlive, types } from "mobx-state-tree";
import type { UserDB } from "./userState/UserModel";
import { User } from "./userState/UserModel";
import { createContext, use } from "react";
import Cookies from "js-cookie";
import { UiState } from "./uiState/UiState";
import * as Api from "../api/users";
import ToastContainer from "../utils/ToastContainer";
import { getErrorMessage } from "../utils/Helpers";
import type { VolumeRenderer } from "../renderer/renderer.ts";

const CookieName = "LoggedUser";

export const RootStore = types
  .model({
    user: types.optional(User, {}),
    uiState: types.optional(UiState, {}),
    wasmLoaded: types.optional(types.boolean, false),
  })
  .volatile(() => ({
    reloadingSession: false,
    triedReloadingSession: false,
    setingUpUser: false,
    renderer: null as VolumeRenderer | null,
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
    setRenderer(renderer: VolumeRenderer | null) {
      if (self.renderer) {
        self.renderer.destroy();
      }
      self.renderer = renderer;
    },
    setReloadingSession(loading: boolean) {
      self.reloadingSession = loading;
    },
    setTriedReloadingSession(loading: boolean) {
      self.triedReloadingSession = loading;
    },

    setWasmLoaded(loaded: boolean) {
      self.wasmLoaded = loaded;
    },
    login(userData: UserDB) {
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
        self.user.userProjects.fetchProjects().catch((error: unknown) => {
          const toastContainer = new ToastContainer();
          toastContainer.error(getErrorMessage(error));
        });
        if (self.user.status) {
          self.user.status.fetchStatus().catch((error: unknown) => {
            const toastContainer = new ToastContainer();
            toastContainer.error(getErrorMessage(error));
          });
        }
        self.uiState.setOpenSignUpPage(false);
        self.uiState.setOpenSignInPage(false);
      } finally {
        self.setingUpUser = false;
      }
    },

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
  const store = use(RootStoreContext);
  if (store === null) {
    throw new Error("Store cannot be null, please add a context provider");
  }
  return store;
}
