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
import VolumeUploadDialog, {
  VolumeDescriptor,
} from "../shared/VolumeUploadDialog";
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

  const visFilesRef = useRef<HTMLInputElement | null>(null);

  const visualizeFiles = async (
    filesArray: File[],
    parameterOverrides?: VolumeSettings
  ) => {
    if (filesArray.length === 0) {
      return;
    }

    let toastId = null;

    try {
      toastId = toast.loading("Parsing volume files...");

      const mrcFile = filesArray.find((file) =>
        file.name.toLowerCase().endsWith(".mrc")
      );

      if (mrcFile) {
        try {
          const { rawFile, jsonFile } = await convertMRCToRaw(mrcFile);
          // Remove the original .mrc file from the list
          filesArray = filesArray.filter(
            (file) => !file.name.toLowerCase().endsWith(".mrc")
          );
          // Add the generated .raw and .json files
          filesArray = [rawFile, jsonFile];
        } catch (error) {
          console.error("Error converting MRC file:", error);
          return;
        }
      }
      //.raw or .zip files, if no JSON metadata file, generate a default one
      const rawFile = filesArray.find((file) =>
        file.name.toLowerCase().endsWith(".raw")
      );

      if (!rawFile) {
        throw new Error("No .raw file found in the uploaded files");
      }

      let volumeSettings = new VolumeSettings({
        ratio: {
          x: 1,
          y: 1,
          z: 1,
        },
        addValue: 0,
        skipBytes: 0,
      });

      const descriptorFileIndex = filesArray.findIndex((file) =>
        file.name.toLowerCase().endsWith(".json")
      );

      if (descriptorFileIndex >= 0) {
        const descriptor = await filesArray[descriptorFileIndex].text();
        const fileSettings = VolumeSettings.fromJSON(descriptor);

        volumeSettings.applyOverrides(fileSettings);
      }

      if (parameterOverrides) {
        volumeSettings.applyOverrides(parameterOverrides);
      }

      volumeSettings.file = rawFile.name;

      volumeSettings.checkValidity();

      const volumeSettingsFile = volumeSettings.toFile();

      if (descriptorFileIndex >= 0) {
        filesArray[descriptorFileIndex] = volumeSettingsFile;
      } else {
        filesArray.push(volumeSettingsFile);
      }

      const fileMap = await Utils.unpackAndcreateFileMap(filesArray);
      await uiState.visualizeVolume(fileMap, undefined);

      const visFilesRef = document.getElementById(
        "fileInput"
      ) as HTMLInputElement;
      if (visFilesRef) {
        visFilesRef.value = "";
      }
    } catch (error) {
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
