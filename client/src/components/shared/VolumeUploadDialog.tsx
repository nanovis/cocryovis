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
  ListItem,
  Text,
  Tooltip,
} from "@fluentui/react-components";
import { useState } from "react";
import Utils from "../../functions/Utils";
import { ArrowResetFilled } from "@fluentui/react-icons";
import { VolumeSettings } from "../../functions/VolumeSettings";

const useStyles = makeStyles({
  dnd: {
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    padding: "20px",
    textAlign: "center",
    cursor: "pointer",
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

export interface VolumeDescriptor {
  file?: string;
  size?: {
    x: number;
    y: number;
    z: number;
  };
  ratio?: {
    x: number;
    y: number;
    z: number;
  };
  bytesPerVoxel?: number;
  usedBits?: number;
  skipBytes?: number;
  isLittleEndian?: boolean;
  isSigned?: boolean;
  addValue?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    files: File[],
    parameterOverrides?: VolumeSettings
  ) => Promise<void>;
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
  onConfirm,
  titleText,
  confirmText,
}: Props) => {
  const classes = useStyles();

  const [isBusy, setIsBusy] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [isFileOver, setIsFileOver] = useState(false);
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [depth, setDepth] = useState<string>("");
  const [format, setFormat] = useState<string>("");
  const [endian, setEndian] = useState<string>("");

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files) {
      const fileMap = await Utils.unpackAndcreateFileMap(event.target.files);
      resetForm();
      if (fileMap.size === 0) {
        return;
      }
      const files = [...fileMap.values()];
      const rawFile = files.find((file) =>
        file.name.toLowerCase().endsWith(".raw")
      );

      if (rawFile) {
        parseRawFile(rawFile, files);
        return;
      }

      const mrcFile = files.find((file) =>
        file.name.toLowerCase().endsWith(".mrc")
      );
      if (mrcFile) {
        parseMrcFile(mrcFile);
        return;
      }
    }
  };

  const parseRawFile = async (rawFile: File, files: File[]) => {
    const outputFiles = [rawFile];
    const descriptorFile = files.find((file) =>
      file.name.toLowerCase().endsWith(".json")
    );
    if (descriptorFile) {
      try {
        const descriptor = await descriptorFile.text();
        const settings = JSON.parse(descriptor);
        if (settings.size) {
          const { x, y, z } = settings.size;
          if (x) setNumericInput(x, setWidth);
          if (y) setNumericInput(y, setHeight);
          if (z) setNumericInput(z, setDepth);
        }
        if ("isLittleEndian" in settings) {
          setDrodownInput(
            settings.isLittleEndian ? "Little Endian" : "Big Endian",
            endianOptions,
            setEndian
          );
        }
        if ("bytesPerVoxel" in settings) {
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
        } else if ("usedBits" in settings) {
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
        outputFiles.push(descriptorFile);
      } catch (error) {
        console.warn("Error parsing descriptor file:", error);
      }
    }

    setFiles(outputFiles);
  };

  const parseMrcFile = (mrcFile: File) => {
    setFiles([mrcFile]);
    setWidth("auto");
    setHeight("auto");
    setDepth("auto");
    setFormat("auto");
    setEndian("auto");
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files) {
      setFiles([...files, ...Array.from(event.dataTransfer.files)]);
    }
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
    setFiles([]);
    setWidth("");
    setHeight("");
    setDepth("");
    setFormat("");
    setEndian("");
  };

  const rawUpload = () => {
    return files.some((file) => file.name.toLowerCase().endsWith(".raw"));
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

  const canConfirm = () => {
    return !isBusy && files.length > 0 && (!rawUpload() || validParameters());
  };

  const confirmEffect = async () => {
    if (!canConfirm()) {
      return;
    }
    try {
      setIsBusy(true);
      if (rawUpload()) {
        const usedBits = parseInt(format.split("-")[0]);
        const bytesPerVoxel = Math.floor(usedBits / 8);
        const isSigned = format.includes("Signed");
        await onConfirm(
          files,
          new VolumeSettings({
            size: {
              x: parseInt(width),
              y: parseInt(height),
              z: parseInt(depth),
            },
            isLittleEndian: endian === "Little Endian",
            bytesPerVoxel: bytesPerVoxel,
            usedBits: usedBits,
            isSigned: isSigned,
          })
        );
      } else {
        onConfirm(files);
      }
    } finally {
      setIsBusy(false);
      onClose();
    }
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            {titleText}
            <Button
              appearance="subtle"
              onClick={resetForm}
              icon={
                <ArrowResetFilled
                  style={{ color: tokens.colorBrandForeground1 }}
                />
              }
            />
          </DialogTitle>
          <DialogContent
            style={{
              paddingTop: "15px",
              paddingBottom: "15px",
              display: "flex",
              flexDirection: "column",
              gap: "15px",
            }}
          >
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
                onClick={() => document.getElementById("fileInput")?.click()}
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
                  {files.length > 0 ? (
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
                        {files.map((file, index) => (
                          <ListItem key={index}>
                            <Text>{file.name}</Text>
                          </ListItem>
                        ))}
                      </div>
                    </List>
                  ) : (
                    <p>Drag & Drop or Click to Select Files</p>
                  )}
                </div>
              </div>
            </Tooltip>
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
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={confirmEffect}
              disabled={!canConfirm()}
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
