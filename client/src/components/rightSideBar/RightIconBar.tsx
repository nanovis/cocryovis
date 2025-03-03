import { useRef } from "react";

import {
  makeStyles,
  tokens,
  mergeClasses,
  Tooltip,
  Button,
} from "@fluentui/react-components";
import {
  BorderNone24Regular,
  ArrowUpload24Regular,
  SlideSettings24Regular,
} from "@fluentui/react-icons";
import globalStyles from "../GlobalStyles";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";
import Utils from "../../functions/Utils";
import { files } from "jszip";
import { convertMRCToRaw } from "../../functions/MrcParser";

const useStyles = makeStyles({
  element: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "16px",
    marginRight: "6px",
    marginLeft: "6px",
    paddingTop: "8px",
    paddingBottom: "8px",
    borderRadius: "2px",
    ":hover": {
      cursor: "pointer",
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  elementSelected: { backgroundColor: tokens.colorNeutralBackground1Hover },
  icon: {
    color: tokens.colorBrandForeground1,
  },
});

interface Props {
  openIcons: boolean[];
  toggleIcons: (id: number) => void;
}

const IconBar = observer(({ openIcons, toggleIcons }: Props) => {
  const { uiState } = useMst();

  const classes = useStyles();
  const globalClasses = globalStyles();

  const visFilesRef = useRef<HTMLInputElement | null>(null);

  const Clicking = (id: number) => {
    toggleIcons(id);
  };

const visualizeFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
  
    const visFilesRef = document.getElementById("fileInput") as HTMLInputElement;
    if (visFilesRef) {
      visFilesRef.value = "";
    }
  };

  return (
    <div
      className={globalClasses.sidebar}
      style={{ borderLeft: `2px solid ${tokens.colorNeutralBackground1Hover}` }}
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
            className={mergeClasses(globalClasses.widgetButton)}
            icon={<ArrowUpload24Regular />}
            onClick={() => visFilesRef.current?.click()}
          />
        </Tooltip>

        <Tooltip
          content="Visualization"
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
            className={mergeClasses(
              globalClasses.widgetButton,
              openIcons[0] && globalClasses.widgetButtonSelected
            )}
            icon={
              <BorderNone24Regular
                className={mergeClasses(openIcons[0] && classes.icon)}
              />
            }
            onClick={() => Clicking(0)}
          />
        </Tooltip>

        <Tooltip
          content="Render Settings"
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
            className={mergeClasses(
              globalClasses.widgetButton,
              openIcons[1] && globalClasses.widgetButtonSelected
            )}
            icon={
              <SlideSettings24Regular
                className={mergeClasses(openIcons[1] && classes.icon)}
              />
            }
            onClick={() => Clicking(1)}
          />
        </Tooltip>
      </div>

      <input
        type="file"
        onChange={visualizeFileInput}
        accept=".raw, .json, .zip, .mrc"
        multiple
        ref={visFilesRef}
        className={globalClasses.hiddenInput}
      />
    </div>
  );
});

export default IconBar;
