import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  tokens,
  makeStyles,
  mergeClasses,
  Field,
  Input,
  Dropdown,
  Option,
  List,
  Text,
  Tooltip,
  TabValue,
  TabList,
  Tab,
} from "@fluentui/react-components";
import { useRef, useState } from "react";
import Utils from "../../functions/Utils";
import { ArrowResetFilled } from "@fluentui/react-icons";
import { VolumeSettings } from "../../functions/VolumeSettings";
import React from "react";

const useStyles = makeStyles({
  dnd: {
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    padding: "20px",
    textAlign: "center",
    cursor: "pointer",
    minHeight: "25px",
    height: "25px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  dndOver: {
    border: `2px dashed ${tokens.colorBrandStroke1}`,
  },
  inputRow: {
    display: "flex",
    justifyContent: "space-between",
  },
  dimensionsField: {
    marginLeft: "5px",
    marginRight: "5px",
  },
  dimensionsInput: {
    width: "100%",
    minWidth: "100%",
  },
});

interface Props {
  open: boolean;
  onClose: () => void;
  onFileConfirm: (file: File, volumeSettings?: VolumeSettings) => Promise<void>;
  onUrlConfirm: (url: string, volumeSettings?: VolumeSettings) => Promise<void>;
  titleText: string;
  confirmText: string;
}

const formatOptions = [
  "8-bit",
  "16-bit Signed",
  "16-bit Unsigned",
  "32-bit Signed",
  "32-bit Unsigned",
  "64-bit Signed",
  "64-bit Unsigned",
];

const endianOptions = ["Little Endian", "Big Endian"];

const VolumeUploadDialog = ({
  open,
  onClose,
  onFileConfirm,
  onUrlConfirm,
  titleText,
  confirmText,
}: Props) => {
  const classes = useStyles();

  const [isBusy, setIsBusy] = useState(false);
  const [tab, setTab] = React.useState<TabValue>("fromFile");

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const volumeSettings = useRef<VolumeSettings | null>(null);

  const [isFileOver, setIsFileOver] = useState(false);
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [depth, setDepth] = useState<string>("");
  const [format, setFormat] = useState<string>("");
  const [endian, setEndian] = useState<string>("");
  const [url, setUrl] = useState<string>("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilesUploaded(event.target.files);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onFilesUploaded(event.dataTransfer.files);
  };

  const rawUpload = () => {
    return pendingFile?.name.toLowerCase().endsWith(".raw");
  };

  const onFilesUploaded = async (files: FileList | null) => {
    try {
      if (files) {
        const fileMap = await Utils.unpackAndcreateFileMap(files);
        resetForm();
        if (fileMap.size === 0) {
          return;
        }
        const unpackedFiles = [...fileMap.values()];
        const rawFile = unpackedFiles.find((file) =>
          file.name.toLowerCase().endsWith(".raw")
        );

        if (rawFile) {
          await parseRawFile(rawFile, unpackedFiles);
          return;
        }

        const descriptorFile = unpackedFiles.find((file) =>
          file.name.toLowerCase().endsWith(".json")
        );

        if (descriptorFile && rawUpload()) {
          parseVolumeSettings(descriptorFile);
          return;
        }

        const mrcFile = unpackedFiles.find((file) =>
          file.name.toLowerCase().endsWith(".mrc")
        );
        if (mrcFile) {
          parseMrcFile(mrcFile);
          return;
        }
      }
    } catch (error) {
      resetForm();
    }
  };

  const parseRawFile = async (rawFile: File, files: File[]) => {
    setPendingFile(rawFile);
    try {
      const descriptorFile = files.find((file) =>
        file.name.toLowerCase().endsWith(".json")
      );
      if (descriptorFile) {
        parseVolumeSettings(descriptorFile);
      }
    } catch (error) {
      console.warn("Error parsing descriptor file:", error);
    }
  };

  const parseVolumeSettings = async (descriptorFile: File) => {
    const descriptor = await descriptorFile.text();
    volumeSettings.current = VolumeSettings.fromJSON(descriptor);

    const settings = volumeSettings.current;

    if (settings.size) {
      const { x, y, z } = settings.size;
      if (x) setNumericInput(x.toString(), setWidth);
      if (y) setNumericInput(y.toString(), setHeight);
      if (z) setNumericInput(z.toString(), setDepth);
    }
    if ("isLittleEndian" in settings) {
      setDrodownInput(
        settings.isLittleEndian ? "Little Endian" : "Big Endian",
        endianOptions,
        setEndian
      );
    }
    if (settings.bytesPerVoxel !== undefined) {
      if (settings.bytesPerVoxel === 1) {
        setFormat("8-bit");
      } else {
        const isSigned = "isSigned" in settings ? settings.isSigned : false;
        setDrodownInput(
          `${settings.bytesPerVoxel * 8}-bit ${
            isSigned ? "Signed" : "Unsigned"
          }`,
          formatOptions,
          setFormat
        );
      }
    } else if (settings.usedBits !== undefined) {
      if (settings.usedBits === 8) {
        setFormat("8-bit");
      } else {
        const isSigned = "isSigned" in settings ? settings.isSigned : false;
        setDrodownInput(
          `${settings.usedBits}-bit ${isSigned ? "Signed" : "Unsigned"}`,
          formatOptions,
          setFormat
        );
      }
    }
  };

  const parseMrcFile = (mrcFile: File) => {
    setPendingFile(mrcFile);
    setWidth("auto");
    setHeight("auto");
    setDepth("auto");
    setFormat("auto");
    setEndian("auto");
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    setIsFileOver(true);
    event.preventDefault();
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    setIsFileOver(false);
    event.preventDefault();
  };

  const validNumericanInput = (value: string) => {
    return /^\d+$/.test(value);
  };

  const validDropdownInput = (value: string, values: string[]) => {
    return values.includes(value);
  };

  const setNumericInput = (value: string, setter: (value: string) => void) => {
    if (validNumericanInput(value)) {
      setter(value);
    }
  };

  const setDrodownInput = (
    value: string,
    values: string[],
    setter: (value: string) => void
  ) => {
    if (validDropdownInput(value, values)) {
      setter(value);
    }
  };

  const resetForm = () => {
    if (tab === "fromUrl") {
      setUrl("");
    } else if (volumeSettings.current) {
      setPendingFile(null);
      volumeSettings.current = null;
    }
    setWidth("");
    setHeight("");
    setDepth("");
    setFormat("");
    setEndian("");
  };

  const canSetParameters = () => {
    return !isBusy && rawUpload();
  };

  const validParameters = () => {
    return (
      validNumericanInput(width) &&
      validNumericanInput(height) &&
      validNumericanInput(depth) &&
      validDropdownInput(format, formatOptions) &&
      validDropdownInput(endian, endianOptions)
    );
  };

  const canConfirmUrl = tab == "fromUrl" && url.length > 0;
  const canConfirmFile =
    tab == "fromFile" &&
    pendingFile !== null &&
    (!rawUpload() || validParameters());

  const canConfirm = !isBusy && (canConfirmUrl || canConfirmFile);

  const confirmEffect = async () => {
    if (isBusy) {
      return;
    }
    try {
      setIsBusy(true);
      if (tab === "fromUrl") {
        await confirmUrl();
        return;
      } else {
        await confirmFile();
      }
    } finally {
      setIsBusy(false);
      onClose();
    }
  };

  const confirmFile = async () => {
    if (!canConfirmFile) {
      return;
    }
    if (rawUpload()) {
      const settings = volumeSettings.current ?? new VolumeSettings();
      settings.usedBits = parseInt(format.split("-")[0]);
      settings.bytesPerVoxel = Math.floor(settings.usedBits / 8);
      settings.isSigned = format.includes("Signed");
      settings.isLittleEndian = endian === "Little Endian";
      settings.size = {
        x: parseInt(width),
        y: parseInt(height),
        z: parseInt(depth),
      };
      await onFileConfirm(pendingFile, settings);
    } else {
      await onFileConfirm(pendingFile);
    }
  };

  const confirmUrl = async () => {
    if (!canConfirmUrl) {
      return;
    }
    await onUrlConfirm(url);
  };

  return (
    <Dialog open={open}>
      <DialogSurface style={{ paddingTop: "0px" }}>
        <DialogBody
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <DialogTitle
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <TabList
              selectedValue={tab}
              onTabSelect={(_, data) => setTab(data.value)}
              disabled={isBusy}
            >
              <Tab style={{ width: "50%" }} id="fromFile" value="fromFile">
                From File
              </Tab>
              <Tab style={{ width: "50%" }} id="fromUrl" value="fromUrl">
                From URL
              </Tab>
            </TabList>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {titleText}
              <Button
                appearance="subtle"
                onClick={resetForm}
                icon={
                  <ArrowResetFilled
                    style={{ color: tokens.colorBrandForeground1 }}
                  />
                }
                disabled={isBusy}
              />
            </div>
          </DialogTitle>

          <DialogContent
            style={{
              minHeight: "250px",
              padding: "15px",
              display: "flex",
              flexDirection: "column",
              gap: "15px",
            }}
          >
            <div style={{ minHeight: "68px" }}>
              {tab === "fromFile" && (
                <Tooltip
                  content={
                    "Currently the importer supports two file formats: RAW and MRC. Raw files can optionally be uploaded alongside a descriptor file."
                  }
                  relationship={"description"}
                  positioning={"after"}
                  appearance={"inverted"}
                  hideDelay={0}
                >
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    className={mergeClasses(
                      classes.dnd,
                      isFileOver && classes.dndOver
                    )}
                    onClick={() =>
                      document.getElementById("fileInput")?.click()
                    }
                  >
                    <input
                      type="file"
                      id="fileInput"
                      multiple
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                      accept=".raw, .json, .zip, .mrc"
                    />
                    <div
                      style={{
                        pointerEvents: "none",
                        color: tokens.colorNeutralForeground2,
                      }}
                    >
                      {pendingFile ? (
                        <List
                          style={{
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                            }}
                          >
                            <Text>{pendingFile.name}</Text>
                          </div>
                        </List>
                      ) : (
                        <p>Drag & Drop or Click to Select Files</p>
                      )}
                    </div>
                  </div>
                </Tooltip>
              )}
              {tab === "fromUrl" && (
                <Input
                  appearance="underline"
                  value={url}
                  onChange={(_, data) => setUrl(data.value)}
                  placeholder="https://www.example_url.com"
                  disabled={isBusy}
                  style={{ width: "100%" }}
                />
              )}
            </div>
            <div className={classes.inputRow}>
              <Field label="Width" className={classes.dimensionsField}>
                <Input
                  value={width}
                  className={classes.dimensionsInput}
                  onChange={(_, data) => setNumericInput(data.value, setWidth)}
                  disabled={!canSetParameters()}
                />
              </Field>
              <Field label="Height" className={classes.dimensionsField}>
                <Input
                  value={height}
                  onChange={(_, data) => setNumericInput(data.value, setHeight)}
                  className={classes.dimensionsInput}
                  disabled={!canSetParameters()}
                />
              </Field>
              <Field label="Depth" className={classes.dimensionsField}>
                <Input
                  value={depth}
                  className={classes.dimensionsInput}
                  onChange={(_, data) => setNumericInput(data.value, setDepth)}
                  disabled={!canSetParameters()}
                />
              </Field>
            </div>
            <div className={classes.inputRow}>
              <Field label="Data Format" className={classes.dimensionsField}>
                <Dropdown
                  onOptionSelect={(_, data) =>
                    setFormat(data.optionValue ?? "")
                  }
                  value={format}
                  placeholder="Select"
                  disabled={!canSetParameters()}
                >
                  {formatOptions.map((option) => (
                    <Option key={option}>{option}</Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Endian" className={classes.dimensionsField}>
                <Dropdown
                  onOptionSelect={(_, data) =>
                    setEndian(data.optionValue ?? "")
                  }
                  value={endian}
                  placeholder="Select"
                  disabled={!canSetParameters()}
                >
                  {endianOptions.map((option) => (
                    <Option key={option}>{option}</Option>
                  ))}
                </Dropdown>
              </Field>
            </div>
          </DialogContent>
          <DialogActions style={{ marginLeft: "auto" }}>
            <Button appearance="secondary" onClick={onClose} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={confirmEffect}
              disabled={!canConfirm}
            >
              {confirmText}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default VolumeUploadDialog;
