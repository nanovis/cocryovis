import Visualization from "./widgets/Visualization";
import RenderSettings from "./widgets/RenderSettings";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";
import globalStyles from "../GlobalStyles";
import { Button, tokens, Tooltip } from "@fluentui/react-components";
import WidgetToggleButton from "../shared/WidgetToggleButton";
import {
  ArrowUpload24Regular,
  BorderNone24Regular,
  Info24Regular,
  SlideSettings24Regular,
} from "@fluentui/react-icons";
import { useState } from "react";
import * as Utils from "../../utils/Helpers";
import { convertMRCToRaw } from "../../utils/MrcParser";
import About from "./widgets/About";
import VolumeUploadDialog from "../shared/VolumeUploadDialog";
import { VolumeSettings } from "../../utils/VolumeSettings";
import ToastContainer from "../../utils/ToastContainer";

const enum WidgetIndices {
  Visualization = 0,
  RenderSettings = 1,
  About = 2,
}

const SideControls = observer(() => {
  const { uiState, pageDisabled } = useMst();
  const globalClasses = globalStyles();

  const [isVisDialogOpen, setIsVisDialogOpen] = useState(false);

  const visualizeFiles = async (
    pendingFile: File,
    volumeSettings?: VolumeSettings
  ) => {
    const toastContainer = new ToastContainer();

    try {
      toastContainer.loading("Parsing volume files...");

      const fileMap = await parseVisualizationFile(pendingFile, volumeSettings);

      toastContainer.loading("isualizing the volume...");

      await uiState.visualizeVolume(fileMap, undefined);
      toastContainer.success("Visualization Ready!");
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      throw error;
    }
  };

  const visualizeUrl = async (
    url: string,
    fileType: string,
    volumeSettings?: VolumeSettings
  ) => {
    const toastContainer = new ToastContainer();

    try {
      toastContainer.loading("Downloading volume files...");
      const response = await fetch(url);
      const blob = await response.blob();
      let filename = Utils.getFilenameFromHeader(response);
      if (!filename) {
        filename = new Date().toISOString();
      }
      filename = Utils.removeExtensionFromPath(filename) + "." + fileType;

      if (!filename) {
        throw new Error("No filename found in the response headers.");
      }

      const pendingFile = new File([blob], filename, {
        type: "application/octet-stream",
      });

      toastContainer.loading("Parsing volume files...");

      await Utils.waitForNextFrame();

      const fileMap = await parseVisualizationFile(pendingFile, volumeSettings);

      toastContainer.loading("Visualizing the volume...");

      await Utils.waitForNextFrame();

      await uiState.visualizeVolume(fileMap, undefined);

      toastContainer.success("Visualization Ready!");
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
    }
  };

  const parseVisualizationFile = async (
    pendingFile: File,
    volumeSettings?: VolumeSettings
  ) => {
    if (Utils.isMrcFile(pendingFile.name)) {
      try {
        const { rawFile, settings } = await convertMRCToRaw(pendingFile);
        pendingFile = rawFile;
        volumeSettings = settings;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error("Error converting MRC file:" + error.message);
        } else {
          throw new Error("Error converting MRC file");
        }
      }
    }

    if (!Utils.isRawFile(pendingFile.name)) {
      throw new Error("No .raw file found in the uploaded files");
    }

    if (!volumeSettings) {
      throw new Error("Missing volume settings");
    }

    volumeSettings.file = pendingFile.name;
    volumeSettings.checkValidity();

    const volumeSettingsFile = volumeSettings.toFile();

    return await Utils.unpackAndcreateFileMap([
      pendingFile,
      volumeSettingsFile,
    ]);
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
            isOpen={uiState.openRightWidget === (WidgetIndices.Visualization as number)}
            onClick={() =>
              uiState.setOpenRightWidget(WidgetIndices.Visualization)
            }
            disabled={!uiState.visualizedVolume || pageDisabled}
          />

          <WidgetToggleButton
            title={"Render Settings"}
            labelPositioning={"before"}
            LabelIcon={SlideSettings24Regular}
            isOpen={uiState.openRightWidget === (WidgetIndices.RenderSettings as number)}
            onClick={() =>
              uiState.setOpenRightWidget(WidgetIndices.RenderSettings)
            }
            disabled={pageDisabled}
          />

          <WidgetToggleButton
            title={"About"}
            labelPositioning={"before"}
            LabelIcon={Info24Regular}
            isOpen={uiState.openRightWidget === (WidgetIndices.About as number)}
            onClick={() => uiState.setOpenRightWidget(WidgetIndices.About)}
            disabled={pageDisabled}
          />
        </div>
      </div>

      <Visualization
        open={uiState.openRightWidget === (WidgetIndices.Visualization as number)}
        close={uiState.closeRightHandWidgets}
      />

      <RenderSettings
        open={uiState.openRightWidget === (WidgetIndices.RenderSettings as number)}
        close={uiState.closeRightHandWidgets}
      />

      <About
        open={uiState.openRightWidget === (WidgetIndices.About as number)}
        close={uiState.closeRightHandWidgets}
      />

      <VolumeUploadDialog
        open={isVisDialogOpen}
        onClose={() => setIsVisDialogOpen(false)}
        onFileConfirm={visualizeFiles}
        onUrlConfirm={visualizeUrl}
        titleText={"Visualize Volume"}
        confirmText="Visualize"
        uploadDialogStore={uiState.uploadDialog}
      />
    </>
  );
});

export default SideControls;
