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
import { toast } from "react-toastify";
import { VolumeSettings } from "../../utils/VolumeSettings";

const enum WidgetIndices {
  Visualization = 0,
  RenderSettings = 1,
  About = 2,
}

const SideControls = observer(() => {
  const { uiState } = useMst();
  const globalClasses = globalStyles();

  const [isVisDialogOpen, setIsVisDialogOpen] = useState(false);

  const visualizeFiles = async (
    pendingFile: File,
    volumeSettings?: VolumeSettings
  ) => {
    let toastId = null;

    try {
      toastId = toast.loading("Parsing volume files...");

      const fileMap = await parseVisualizationFile(pendingFile, volumeSettings);

      toast.update(toastId, {
        render: "Visualizing the volume...",
        isLoading: true,
        autoClose: false,
      });

      await uiState.visualizeVolume(fileMap, undefined);

      toast.update(toastId, {
        render: "Visualization Ready!",
        type: "success",
        isLoading: false,
        autoClose: 2000,
        closeOnClick: true,
      });
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      throw error;
    }
  };

  const visualizeUrl = async (
    url: string,
    fileType: string,
    volumeSettings?: VolumeSettings
  ) => {
    let toastId = null;

    try {
      toastId = toast.loading("Downloading volume files...");
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

      toast.update(toastId, {
        render: "Parsing volume files...",
        isLoading: true,
        autoClose: false,
      });
      await Utils.waitForNextFrame();

      const fileMap = await parseVisualizationFile(pendingFile, volumeSettings);

      toast.update(toastId, {
        render: "Visualizing the volume...",
        isLoading: true,
        autoClose: false,
      });
      await Utils.waitForNextFrame();

      await uiState.visualizeVolume(fileMap, undefined);

      toast.update(toastId, {
        render: "Visualization Ready!",
        type: "success",
        isLoading: false,
        autoClose: 2000,
        closeOnClick: true,
      });
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
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
            />
          </Tooltip>

          <WidgetToggleButton
            title={"Visualization"}
            labelPositioning={"before"}
            LabelIcon={BorderNone24Regular}
            isOpen={uiState.openRightWidget === WidgetIndices.Visualization}
            onClick={() =>
              uiState.setOpenRightWidget(WidgetIndices.Visualization)
            }
            disabled={!uiState.visualizedVolume}
          />

          <WidgetToggleButton
            title={"Render Settings"}
            labelPositioning={"before"}
            LabelIcon={SlideSettings24Regular}
            isOpen={uiState.openRightWidget === WidgetIndices.RenderSettings}
            onClick={() =>
              uiState.setOpenRightWidget(WidgetIndices.RenderSettings)
            }
          />

          <WidgetToggleButton
            title={"About"}
            labelPositioning={"before"}
            LabelIcon={Info24Regular}
            isOpen={uiState.openRightWidget === WidgetIndices.About}
            onClick={() => uiState.setOpenRightWidget(WidgetIndices.About)}
          />
        </div>
      </div>

      <Visualization
        open={uiState.openRightWidget === WidgetIndices.Visualization}
        close={uiState.closeRightHandWidgets}
      />

      <RenderSettings
        open={uiState.openRightWidget === WidgetIndices.RenderSettings}
        close={uiState.closeRightHandWidgets}
      />

      <About
        open={uiState.openRightWidget === WidgetIndices.About}
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
