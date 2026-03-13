import {
  getParentOfType,
  type Instance,
  isAlive,
  type SnapshotIn,
} from "mobx-state-tree";
import { flow, types } from "mobx-state-tree";
import type {
  visualizedObjectInstances,
  VisualizedVolumeInput,
  VisualizedVolumeSnapshotIn,
} from "./VisualizedVolume";
import { VisualizedVolume } from "./VisualizedVolume";
import { RenderSettings } from "./RenderSettings";
import { UploadDialog } from "./UploadDialog";
import { TiltSeriesDialog } from "./TiltSeriesDialog";
import { visualizeVolumeFromConfig } from "@/utils/volumeVisualization";
import type { VisualizationDescriptor } from "@/renderer/volume/volumeManager";
import { RootStore } from "../RootStore";
import type { VolumeRenderer } from "@/renderer/renderer";

export const UiState = types
  .model({
    openLeftWidget: types.optional(types.number, -1),
    openRightWidget: types.optional(types.number, -1),
    openSignInPage: types.optional(types.boolean, false),
    openSignUpPage: types.optional(types.boolean, false),
    openProfilePage: types.optional(types.boolean, false),
    openAdminPanel: types.optional(types.boolean, false),
    kernelSize: types.optional(types.integer, 25),
    visualizedVolume: types.maybe(VisualizedVolume),
    renderSettings: types.optional(RenderSettings, {}),
    uploadDialog: types.optional(UploadDialog, {}),
    tiltSeriesDialogServer: types.optional(TiltSeriesDialog, {}),
    tiltSeriesDialogClient: types.optional(TiltSeriesDialog, {}),
  })
  .volatile(() => ({
    isSignInOrSignUpInProgress: false,
  }))
  .views((self) => ({
    get renderer(): VolumeRenderer | null {
      const rootStore = getParentOfType<typeof RootStore>(self, RootStore);
      return rootStore.renderer;
    },
  }))
  .actions((self) => ({
    setOpenLeftWidget(id: number) {
      self.openLeftWidget = self.openLeftWidget !== id ? id : -1;
    },
    closeLeftHandWidgets() {
      self.openLeftWidget = -1;
    },
    setOpenRightWidget(id: number) {
      self.openRightWidget = self.openRightWidget !== id ? id : -1;
    },
    closeRightHandWidgets() {
      self.openRightWidget = -1;
    },
    setIsActive(active: boolean) {
      self.isSignInOrSignUpInProgress = active;
    },
    setOpenProfilePage(open: boolean) {
      self.openProfilePage = open;
      if (self.openProfilePage) {
        self.openAdminPanel = false;
      }
    },
    toggleOpenProfilePage() {
      self.openProfilePage = !self.openProfilePage;
      if (self.openProfilePage) {
        self.openAdminPanel = false;
      }
    },
    setOpenAdminPage(open: boolean) {
      self.openAdminPanel = open;
      if (self.openAdminPanel) {
        self.openProfilePage = false;
      }
    },
    toggleOpenAdminPage() {
      self.openAdminPanel = !self.openAdminPanel;
      if (self.openAdminPanel) {
        self.openProfilePage = false;
      }
    },
    toggleSignInPage() {
      self.openSignInPage = !self.openSignInPage;
      if (self.openSignInPage) {
        self.openSignUpPage = false;
      }
    },
    setOpenSignInPage(open: boolean) {
      self.openSignInPage = open;
      if (self.openSignInPage) {
        self.openSignUpPage = false;
      }
    },
    toggleSignUpPage() {
      self.openSignUpPage = !self.openSignUpPage;
      if (self.openSignUpPage) {
        self.openSignInPage = false;
      }
    },
    setOpenSignUpPage(open: boolean) {
      self.openSignUpPage = open;
      if (self.openSignUpPage) {
        self.openSignInPage = false;
      }
    },
    setKernelSize(kernalSize: number) {
      if (!self.renderer) return;
      self.kernelSize = kernalSize;
      self.renderer.annotationManager.annotationParameterBuffer.set({
        kernelSize: [kernalSize, kernalSize, kernalSize, 0],
      });
    },
    setVizualizedVolume(properties: VisualizedVolumeInput) {
      self.visualizedVolume = VisualizedVolume.create(properties);
      self.visualizedVolume.setVisualizedObject(properties.visualizedObject);
    },
  }))
  .actions((self) => ({
    visualizeVolume: flow(function* (
      config: VisualizationDescriptor,
      visualizedObject?: visualizedObjectInstances
    ): Generator<
      Promise<VisualizedVolumeSnapshotIn>,
      void,
      VisualizedVolumeSnapshotIn
    > {
      const rootStore = getParentOfType(self, RootStore);
      if (!rootStore.renderer) {
        console.warn("Renderer not initialized yet.");
        return;
      }
      const visualizedVolume = yield visualizeVolumeFromConfig(
        rootStore.renderer,
        config,
        visualizedObject
      );

      if (!isAlive(self)) return;
      self.setVizualizedVolume(visualizedVolume);
    }),
  }));

export interface UiStateInstance extends Instance<typeof UiState> {}
export interface UiStateSnapshotIn extends SnapshotIn<typeof UiState> {}
