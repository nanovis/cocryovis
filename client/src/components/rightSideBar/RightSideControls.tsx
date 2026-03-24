import Visualization from "./widgets/Visualization";
import RenderSettings from "./widgets/RenderSettings";
import { observer } from "mobx-react-lite";
import { useMst } from "@/stores/RootStore";
import globalStyles from "../globalStyles";
import {
  Button,
  Divider,
  Link,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import WidgetToggleButton from "../shared/WidgetToggleButton";
import {
  ArrowUpload24Regular,
  BookInformationRegular,
  BorderNone24Regular,
  DataLine24Regular,
  Info24Regular,
  SaveImageRegular,
  SlideSettings24Regular,
} from "@fluentui/react-icons";
import { useState } from "react";
import * as Utils from "../../utils/helpers";
import About from "./widgets/About";
import VolumeUploadDialog from "../shared/VolumeUploadDialog";
import type { VolumeDescriptor } from "@/utils/volumeDescriptor";
import ToastContainer from "../../utils/toastContainer";
import type { VisualizationDescriptor } from "@/renderer/volume/volumeManager";
import TransferFunctions from "./widgets/TransferFunctions";

const enum WidgetIndices {
  Visualization = 0,
  TransferFunctions = 1,
  RenderSettings = 2,
  About = 3,
}

const USER_MANUAL_POPOVER_KEY = "volweb_user_manual_popover_seen";

const SideControls = observer(() => {
  const { uiState, pageDisabled, wasmLoaded } = useMst();
  const globalClasses = globalStyles();

  const [isVisDialogOpen, setIsVisDialogOpen] = useState(false);
  const [showUserManualPopover, setShowUserManualPopover] = useState(
    () =>
      import.meta.env.VITE_ALWAYS_FIRST_TIME === "true" ||
      !localStorage.getItem(USER_MANUAL_POPOVER_KEY)
  );

  const dismissUserManualPopover = () => {
    localStorage.setItem(USER_MANUAL_POPOVER_KEY, "true");
    setShowUserManualPopover(false);
  };

  const visualizeVolume = async (volumeDescriptor: VolumeDescriptor) => {
    const toastContainer = new ToastContainer();

    try {
      const visualizationDescriptor: VisualizationDescriptor = {
        descriptors: [volumeDescriptor],
      };

      toastContainer.loading("Visualizing the volume...");

      await uiState.visualizeVolume(visualizationDescriptor);
      toastContainer.success("Visualization Ready!");
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      throw error;
    }
  };

  const downloadCanvasImage = () => {
    // Find canvas by id
    const canvas = document.getElementById(
      "renderer-canvas"
    ) as HTMLCanvasElement | null;
    if (!canvas) {
      console.error("Canvas element not found");
      return;
    }
    if (!uiState.visualizedVolume) {
      console.error("No visualized volume found");
      return;
    }
    Utils.downloadCanvas(canvas, "rendered_image.png");
  };

  return (
    <>
      <div
        className={globalClasses.sidebar}
        style={{
          borderLeft: `2px solid ${tokens.colorNeutralBackground1Hover}`,
        }}
      >
        <div className={globalClasses.widgetButtonContainer}>
          <Tooltip
            content="Visualize Local Volume"
            relationship="label"
            appearance="inverted"
            positioning="before"
            showDelay={0}
            hideDelay={0}
            withArrow={true}
          >
            <Button
              appearance="subtle"
              size="large"
              className={globalClasses.widgetButton}
              icon={<ArrowUpload24Regular />}
              onClick={() => setIsVisDialogOpen(true)}
              disabled={pageDisabled}
            />
          </Tooltip>

          <WidgetToggleButton
            title={"Visualization"}
            labelPositioning={"before"}
            LabelIcon={BorderNone24Regular}
            isOpen={
              uiState.openRightWidget ===
              (WidgetIndices.Visualization as number)
            }
            onClick={() =>
              uiState.setOpenRightWidget(WidgetIndices.Visualization)
            }
            disabled={!uiState.visualizedVolume || pageDisabled}
          />

          <WidgetToggleButton
            title={"Transfer Functions"}
            labelPositioning={"before"}
            LabelIcon={DataLine24Regular}
            isOpen={
              uiState.openRightWidget ===
              (WidgetIndices.TransferFunctions as number)
            }
            onClick={() =>
              uiState.setOpenRightWidget(WidgetIndices.TransferFunctions)
            }
            disabled={!uiState.visualizedVolume || pageDisabled}
          />

          <WidgetToggleButton
            title={"Render Settings"}
            labelPositioning={"before"}
            LabelIcon={SlideSettings24Regular}
            isOpen={
              uiState.openRightWidget ===
              (WidgetIndices.RenderSettings as number)
            }
            onClick={() =>
              uiState.setOpenRightWidget(WidgetIndices.RenderSettings)
            }
            disabled={pageDisabled}
          />

          <Popover
            open={showUserManualPopover && wasmLoaded}
            withArrow={true}
            positioning="before"
            appearance="inverted"
            onOpenChange={(_event, data) => {
              if (!data.open && showUserManualPopover) {
                dismissUserManualPopover();
              }
            }}
          >
            <PopoverTrigger>
              <Link
                target="_"
                href={`https://docs.google.com/document/d/e/2PACX-1vQjgHSJ-kbe5bFp9JzaNPWlbikrnTgdI2qDPw3l4bJ8cBBG4nP9Mq-aS_cxLYYdUgaD01xbrsIAPFT9/pub`}
                onClick={dismissUserManualPopover}
              >
                <Tooltip
                  content="User Manual [Opens in new tab]"
                  relationship="label"
                  appearance="inverted"
                  positioning="before"
                  showDelay={0}
                  hideDelay={0}
                  withArrow={true}
                >
                  <Button
                    appearance="subtle"
                    size="large"
                    className={globalClasses.widgetButton}
                    icon={<BookInformationRegular />}
                  />
                </Tooltip>
              </Link>
            </PopoverTrigger>
            <PopoverSurface>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxWidth: 240,
                }}
              >
                <span>Open the User Manual for a quick walkthrough.</span>
                <Button
                  size="small"
                  appearance="primary"
                  onClick={dismissUserManualPopover}
                >
                  Got it
                </Button>
              </div>
            </PopoverSurface>
          </Popover>

          <WidgetToggleButton
            title={"About"}
            labelPositioning={"before"}
            LabelIcon={Info24Regular}
            isOpen={uiState.openRightWidget === (WidgetIndices.About as number)}
            onClick={() => uiState.setOpenRightWidget(WidgetIndices.About)}
            disabled={pageDisabled}
          />

          <Divider />

          <Tooltip
            content="Save Rendered Image"
            relationship="label"
            appearance="inverted"
            positioning={"before"}
            withArrow={true}
            showDelay={0}
            hideDelay={0}
          >
            <Button
              appearance="subtle"
              size="large"
              icon={
                <span>
                  <SaveImageRegular style={{ width: 24, height: 24 }} />
                </span>
              }
              onClick={downloadCanvasImage}
              disabled={!uiState.visualizedVolume || pageDisabled}
            />
          </Tooltip>
        </div>
      </div>

      <Visualization
        open={
          uiState.openRightWidget === (WidgetIndices.Visualization as number)
        }
        close={uiState.closeRightHandWidgets}
      />

      <TransferFunctions
        open={
          uiState.openRightWidget ===
          (WidgetIndices.TransferFunctions as number)
        }
        close={uiState.closeRightHandWidgets}
      />

      <RenderSettings
        open={
          uiState.openRightWidget === (WidgetIndices.RenderSettings as number)
        }
        close={uiState.closeRightHandWidgets}
      />

      <About
        open={uiState.openRightWidget === (WidgetIndices.About as number)}
        close={uiState.closeRightHandWidgets}
      />

      <VolumeUploadDialog
        open={isVisDialogOpen}
        onClose={() => setIsVisDialogOpen(false)}
        onConfirm={visualizeVolume}
        titleText={"Visualize Volume"}
        confirmText="Visualize"
        uploadDialogStore={uiState.uploadDialog}
      />
    </>
  );
});

export default SideControls;
