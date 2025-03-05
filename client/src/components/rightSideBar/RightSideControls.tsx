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
  InfoRegular,
  SlideSettings24Regular,
} from "@fluentui/react-icons";
import { useRef, useState } from "react";
import Utils from "../../functions/Utils";
import { convertMRCToRaw } from "../../functions/MrcParser";
import About from "./widgets/About";
import VolumeUploadDialog from "../shared/VolumeUploadDialog";
import { toast } from "react-toastify";
import { VolumeSettings } from "../../functions/VolumeSettings";

const widgets: Array<WidgetDefinition> = [
  {
    title: "Visualization",
    labelPositioning: "before",
    LabelIcon: BorderNone24Regular,
    widget: Visualization,
  },
  {
    title: "Render Settings",
    labelPositioning: "before",
    LabelIcon: SlideSettings24Regular,
    widget: RenderSettings,
  },
  {
    title: "About",
    labelPositioning: "before",
    LabelIcon: InfoRegular,
    widget: About,
  },
];

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

      if (Utils.isMrcFile(pendingFile.name)) {
        try {
          const { rawFile, settings } = await convertMRCToRaw(pendingFile);
          pendingFile = rawFile;
          volumeSettings = settings;
        } catch (error) {
          console.error("Error converting MRC file:", error);
          return;
        }
      }

      if (!Utils.isRawFile(pendingFile.name)) {
        throw new Error("No .raw file found in the uploaded files");
      }

      if (!volumeSettings) {
        throw new Error("Missing volume settings");
      }

      volumeSettings.checkValidity();

      const volumeSettingsFile = volumeSettings.toFile();

      const fileMap = await Utils.unpackAndcreateFileMap([
        pendingFile,
        volumeSettingsFile,
      ]);

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
            content="Select Files from Disk"
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

          {widgets.map((widget, index) => (
            <WidgetToggleButton
              key={index}
              title={widget.title}
              labelPositioning={widget.labelPositioning}
              LabelIcon={widget.LabelIcon}
              isOpen={uiState.openRightWidget === index}
              onClick={() => uiState.setOpenRightWidget(index)}
            />
          ))}
        </div>
      </div>

      {widgets.map((widget, index) => (
        <widget.widget
          key={index}
          open={uiState.openRightWidget === index}
          close={uiState.closeRightHandWidgets}
        />
      ))}

      <VolumeUploadDialog
        open={isVisDialogOpen}
        onClose={() => setIsVisDialogOpen(false)}
        onConfirm={visualizeFiles}
        titleText={"Visualize Volume"}
        confirmText="Visualize"
      />
    </>
  );
});

export default SideControls;
