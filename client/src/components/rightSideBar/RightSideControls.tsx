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
  SlideSettings24Regular,
} from "@fluentui/react-icons";
import { useRef } from "react";
import Utils from "../../functions/Utils";
import { convertMRCToRaw } from "../../functions/MrcParser";

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
];

const SideControls = observer(() => {
  const { uiState } = useMst();
  const globalClasses = globalStyles();

  const visFilesRef = useRef<HTMLInputElement | null>(null);

  const visualizeFileInput = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const inputElement = event.target as HTMLInputElement;
    if (!inputElement.files || inputElement.files.length === 0) {
      return;
    }

    // Convert FileList to array.
    let filesArray = Array.from(inputElement.files);

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
        filesArray.push(rawFile, jsonFile);
      } catch (error) {
        console.error("Error converting MRC file:", error);
        return;
      }
    }
    //.raw or .zip files, if no JSON metadata file, generate a default one
    const rawFile = filesArray.find((file) =>
      file.name.toLowerCase().endsWith(".raw")
    );
    const hasJsonFile = filesArray.some((file) =>
      file.name.toLowerCase().endsWith(".json")
    );

    if (rawFile && !hasJsonFile) {
      const defaultJsonContent = {
        file: rawFile.name,
        size: { x: 512, y: 512, z: 512 },
        ratio: { x: 1.0, y: 1.0, z: 1.0 },
        bytesPerVoxel: 1,
        usedBits: 8,
        skipBytes: 0,
        isLittleEndian: true,
        isSigned: false,
        addValue: 0,
      };

      const defaultJson = new File(
        [JSON.stringify(defaultJsonContent, null, 2)],
        rawFile.name.replace(/\.raw$/i, ".json"),
        { type: "application/json" }
      );

      filesArray.push(defaultJson);
    }

    //downstream code requires a FileList, we use DataTransfer to create a new FileList
    const dataTransfer = new DataTransfer();
    filesArray.forEach((file) => dataTransfer.items.add(file));
    const updatedFileList = dataTransfer.files;

    const fileMap = await Utils.unpackAndcreateFileMap(updatedFileList);
    await uiState.visualizeVolume(fileMap, undefined);

    const visFilesRef = document.getElementById(
      "fileInput"
    ) as HTMLInputElement;
    if (visFilesRef) {
      visFilesRef.value = "";
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
              onClick={() => visFilesRef.current?.click()}
            />
          </Tooltip>

          <input
            type="file"
            onChange={visualizeFileInput}
            accept=".raw, .json, .zip, .mrc"
            multiple
            ref={visFilesRef}
            className={globalClasses.hiddenInput}
          />

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
    </>
  );
});

export default SideControls;
