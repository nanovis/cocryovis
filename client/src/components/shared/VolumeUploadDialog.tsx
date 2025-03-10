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
  TabList,
  Tab,
  Textarea,
} from "@fluentui/react-components";
import { useState } from "react";
import Utils from "../../functions/Utils";
import {
  ArrowResetFilled,
  Checkmark24Filled,
  Info24Regular,
} from "@fluentui/react-icons";
import { VolumeSettings } from "../../functions/VolumeSettings";
import React from "react";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";
import {
  endianOptions,
  fileTypeOptions,
  formatOptions,
  Tabs,
} from "../../stores/uiState/UploadDialog";
import globalStyles from "../GlobalStyles";

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
    flex: "1 1 auto",
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
  tabContent: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  topInput: {
    minHeight: "70px",
    display: "flex",
    marginLeft: "5px",
    marginRight: "5px",
  },
});

interface Props {
  open: boolean;
  onClose: () => void;
  onFileConfirm: (file: File, volumeSettings?: VolumeSettings) => Promise<void>;
  onUrlConfirm: (
    url: string,
    fileType: string,
    volumeSettings?: VolumeSettings
  ) => Promise<void>;
  titleText: string;
  confirmText: string;
}

const VolumeUploadDialog = observer(
  ({
    open,
    onClose,
    onFileConfirm,
    onUrlConfirm,
    titleText,
    confirmText,
  }: Props) => {
    const classes = useStyles();
    const globalClasses = globalStyles();

    const { uiState } = useMst();
    const uploadDialog = uiState.uploadDialog;
    const fileUploadInputs = uploadDialog.fileUploadInputs;
    const urlUploadInputs = uploadDialog.urlUploadInputs;
    const cryoETUploadInputs = uploadDialog.cryoETUploadInputs;

    const [isBusy, setIsBusy] = useState(false);

    const [isFileOver, setIsFileOver] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onFilesUploaded(event.target.files);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      onFilesUploaded(event.dataTransfer.files);
    };

    const onFilesUploaded = async (files: FileList | null) => {
      try {
        if (files) {
          const fileMap = await Utils.unpackAndcreateFileMap(files);
          fileUploadInputs.reset();
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

          if (descriptorFile && fileUploadInputs.rawUpload()) {
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
        fileUploadInputs.reset();
      }
    };

    const parseRawFile = async (rawFile: File, files: File[]) => {
      fileUploadInputs.setPendingFile(rawFile);
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
      const settings = VolumeSettings.fromJSON(descriptor);

      if (settings.size) {
        const { x, y, z } = settings.size;
        if (x) fileUploadInputs.setWidth(x.toString());
        if (y) fileUploadInputs.setHeight(y.toString());
        if (z) fileUploadInputs.setDepth(z.toString());
      }
      if ("isLittleEndian" in settings) {
        fileUploadInputs.setEndian(
          settings.isLittleEndian ? "Little Endian" : "Big Endian"
        );
      }
      if (settings.bytesPerVoxel !== undefined) {
        if (settings.bytesPerVoxel === 1) {
          fileUploadInputs.setFormat("8-bit");
        } else {
          const isSigned = "isSigned" in settings ? settings.isSigned : false;
          fileUploadInputs.setFormat(
            `${settings.bytesPerVoxel * 8}-bit ${
              isSigned ? "Signed" : "Unsigned"
            }`
          );
        }
      } else if (settings.usedBits !== undefined) {
        if (settings.usedBits === 8) {
          fileUploadInputs.setFormat("8-bit");
        } else {
          const isSigned = "isSigned" in settings ? settings.isSigned : false;
          fileUploadInputs.setFormat(
            `${settings.usedBits}-bit ${isSigned ? "Signed" : "Unsigned"}`
          );
        }
      }
    };

    const parseMrcFile = (mrcFile: File) => {
      fileUploadInputs.setPendingFile(mrcFile);
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

    const canSetFileParameters = () => {
      return !isBusy && fileUploadInputs.rawUpload();
    };

    const canSetUrlParameters = () => {
      return !isBusy && urlUploadInputs.fileType === "raw";
    };

    const fetchCryoETMetadata = async () => {
      setIsBusy(true);
      cryoETUploadInputs.fetchCryoETMetadata();
      setIsBusy(false);
    };

    const confirmEffect = async () => {
      if (isBusy) {
        return;
      }
      try {
        setIsBusy(true);
        if (uploadDialog.tab === Tabs.fromCryoET) {
          await confirmCryoET();
          return;
        } else if (uploadDialog.tab === Tabs.fromUrl) {
          await confirmUrl();
          return;
        } else {
          await confirmFile();
        }
      } catch {
      } finally {
        setIsBusy(false);
        onClose();
      }
    };

    const confirmFile = async () => {
      if (!fileUploadInputs.isValid()) {
        return;
      }
      if (fileUploadInputs.rawUpload()) {
        const settings = fileUploadInputs.toVolumeSettings();
        await onFileConfirm(fileUploadInputs.getFile(), settings);
      } else {
        await onFileConfirm(fileUploadInputs.getFile());
      }
    };

    const confirmUrl = async () => {
      if (!urlUploadInputs.isValid()) {
        return;
      }
      if (urlUploadInputs.rawUpload()) {
        const settings = urlUploadInputs.toVolumeSettings();
        await onUrlConfirm(
          urlUploadInputs.url,
          urlUploadInputs.fileType,
          settings
        );
      } else {
        await onUrlConfirm(urlUploadInputs.url, urlUploadInputs.fileType);
      }
    };

    const confirmCryoET = async () => {
      if (!cryoETUploadInputs.isValid()) {
        return;
      }
      await onUrlConfirm(cryoETUploadInputs.url, "mrc");
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
                selectedValue={uploadDialog.tab}
                onTabSelect={(_, data) =>
                  uploadDialog.setTab(data.value as Tabs)
                }
                disabled={isBusy}
              >
                <Tab style={{ width: "33%" }} value={Tabs.fromFile}>
                  From File
                </Tab>
                <Tab style={{ width: "33%" }} value={Tabs.fromUrl}>
                  From URL
                </Tab>
                <Tab style={{ width: "33%" }} value={Tabs.fromCryoET}>
                  From CryoET
                </Tab>
              </TabList>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {titleText}
                <Button
                  appearance="subtle"
                  onClick={uploadDialog.resetCurrentTab}
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
                minHeight: "252px",
                padding: "15px",
              }}
            >
              {uploadDialog.tab === Tabs.fromFile && (
                <div className={classes.tabContent}>
                  <div className={classes.topInput}>
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
                          {fileUploadInputs.pendingFile ? (
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
                                <Text>{fileUploadInputs.pendingFile.name}</Text>
                              </div>
                            </List>
                          ) : (
                            <p>Drag & Drop or Click to Select Files</p>
                          )}
                        </div>
                      </div>
                    </Tooltip>
                  </div>
                  <div className={classes.inputRow}>
                    <Field label="Width" className={classes.dimensionsField}>
                      <Input
                        value={
                          fileUploadInputs.mrcUpload()
                            ? "auto"
                            : fileUploadInputs.width?.toString() ?? ""
                        }
                        className={classes.dimensionsInput}
                        onChange={(_, data) =>
                          fileUploadInputs.setWidth(data.value)
                        }
                        disabled={!canSetFileParameters()}
                      />
                    </Field>
                    <Field label="Height" className={classes.dimensionsField}>
                      <Input
                        value={
                          fileUploadInputs.mrcUpload()
                            ? "auto"
                            : fileUploadInputs.height?.toString() ?? ""
                        }
                        onChange={(_, data) =>
                          fileUploadInputs.setHeight(data.value)
                        }
                        className={classes.dimensionsInput}
                        disabled={!canSetFileParameters()}
                      />
                    </Field>
                    <Field label="Depth" className={classes.dimensionsField}>
                      <Input
                        value={
                          fileUploadInputs.mrcUpload()
                            ? "auto"
                            : fileUploadInputs.depth?.toString() ?? ""
                        }
                        className={classes.dimensionsInput}
                        onChange={(_, data) =>
                          fileUploadInputs.setDepth(data.value)
                        }
                        disabled={!canSetFileParameters()}
                      />
                    </Field>
                  </div>
                  <div className={classes.inputRow}>
                    <Field
                      label="Data Format"
                      className={classes.dimensionsField}
                    >
                      <Dropdown
                        onOptionSelect={(_, data) =>
                          fileUploadInputs.setFormat(data.optionValue)
                        }
                        value={
                          !fileUploadInputs.mrcUpload() &&
                          fileUploadInputs.format
                            ? fileUploadInputs.format
                            : ""
                        }
                        placeholder={
                          fileUploadInputs.mrcUpload() ? "auto" : "Select"
                        }
                        disabled={!canSetFileParameters()}
                      >
                        {formatOptions.map((option) => (
                          <Option key={option}>{option}</Option>
                        ))}
                      </Dropdown>
                    </Field>
                    <Field label="Endian" className={classes.dimensionsField}>
                      <Dropdown
                        onOptionSelect={(_, data) =>
                          fileUploadInputs.setEndian(data.optionValue)
                        }
                        value={
                          !fileUploadInputs.mrcUpload() &&
                          fileUploadInputs.endian
                            ? fileUploadInputs.endian
                            : ""
                        }
                        placeholder={
                          fileUploadInputs.mrcUpload() ? "auto" : "Select"
                        }
                        disabled={!canSetFileParameters()}
                      >
                        {endianOptions.map((option) => (
                          <Option key={option}>{option}</Option>
                        ))}
                      </Dropdown>
                    </Field>
                  </div>
                </div>
              )}
              {uploadDialog.tab === Tabs.fromUrl && (
                <div className={classes.tabContent}>
                  <div className={classes.topInput}>
                    <Textarea
                      value={urlUploadInputs.url}
                      onChange={(_, data) => urlUploadInputs.setUrl(data.value)}
                      placeholder="https://www.example_url.com"
                      disabled={isBusy}
                      style={{ width: "100%" }}
                    />
                    <Field
                      label="File Type"
                      style={{
                        marginLeft: "20px",
                      }}
                    >
                      <Dropdown
                        onOptionSelect={(_, data) =>
                          urlUploadInputs.setFileType(data.optionValue ?? "mrc")
                        }
                        value={urlUploadInputs.fileType}
                        placeholder="Select"
                        disabled={isBusy}
                        style={{
                          width: "100px",
                          minWidth: "100px",
                        }}
                        listbox={{
                          style: {
                            width: "100px",
                            minWidth: "100px",
                          },
                        }}
                      >
                        {fileTypeOptions.map((option) => (
                          <Option key={option}>{option}</Option>
                        ))}
                      </Dropdown>
                    </Field>
                  </div>
                  <div className={classes.inputRow}>
                    <Field label="Width" className={classes.dimensionsField}>
                      <Input
                        value={
                          urlUploadInputs.mrcUpload()
                            ? "auto"
                            : urlUploadInputs.width?.toString() ?? ""
                        }
                        className={classes.dimensionsInput}
                        onChange={(_, data) =>
                          urlUploadInputs.setWidth(data.value)
                        }
                        disabled={!canSetUrlParameters()}
                      />
                    </Field>
                    <Field label="Height" className={classes.dimensionsField}>
                      <Input
                        value={
                          urlUploadInputs.mrcUpload()
                            ? "auto"
                            : urlUploadInputs.height?.toString() ?? ""
                        }
                        onChange={(_, data) =>
                          urlUploadInputs.setHeight(data.value)
                        }
                        className={classes.dimensionsInput}
                        disabled={!canSetUrlParameters()}
                      />
                    </Field>
                    <Field label="Depth" className={classes.dimensionsField}>
                      <Input
                        value={
                          urlUploadInputs.mrcUpload()
                            ? "auto"
                            : urlUploadInputs.depth?.toString() ?? ""
                        }
                        className={classes.dimensionsInput}
                        onChange={(_, data) =>
                          urlUploadInputs.setDepth(data.value)
                        }
                        disabled={!canSetUrlParameters()}
                      />
                    </Field>
                  </div>
                  <div className={classes.inputRow}>
                    <Field
                      label="Data Format"
                      className={classes.dimensionsField}
                    >
                      <Dropdown
                        onOptionSelect={(_, data) =>
                          urlUploadInputs.setFormat(data.optionValue)
                        }
                        value={
                          !urlUploadInputs.mrcUpload() && urlUploadInputs.format
                            ? urlUploadInputs.format
                            : ""
                        }
                        placeholder={
                          urlUploadInputs.mrcUpload() ? "auto" : "Select"
                        }
                        disabled={!canSetUrlParameters()}
                      >
                        {formatOptions.map((option) => (
                          <Option key={option}>{option}</Option>
                        ))}
                      </Dropdown>
                    </Field>
                    <Field label="Endian" className={classes.dimensionsField}>
                      <Dropdown
                        onOptionSelect={(_, data) =>
                          urlUploadInputs.setEndian(data.optionValue ?? "")
                        }
                        value={
                          !urlUploadInputs.mrcUpload() && urlUploadInputs.endian
                            ? urlUploadInputs.endian
                            : ""
                        }
                        placeholder={
                          urlUploadInputs.mrcUpload() ? "auto" : "Select"
                        }
                        disabled={!canSetUrlParameters()}
                      >
                        {endianOptions.map((option) => (
                          <Option key={option}>{option}</Option>
                        ))}
                      </Dropdown>
                    </Field>
                  </div>
                </div>
              )}
              {uploadDialog.tab === Tabs.fromCryoET && (
                <div className={classes.tabContent}>
                  <div
                    className={classes.topInput}
                    style={{ flexDirection: "column", gap: "10px" }}
                  >
                    <div style={{ display: "flex" }}>
                      <Field style={{ flex: 1 }}>
                        <Input
                          value={cryoETUploadInputs.cryoETId?.toString() ?? ""}
                          onChange={(_, data) =>
                            cryoETUploadInputs.setCryoETId(data.value)
                          }
                          disabled={isBusy}
                          style={{ width: "100%" }}
                          placeholder={"Enter CryoET Tomogram ID"}
                        />
                      </Field>
                      <Button
                        appearance="primary"
                        style={{ marginLeft: "10px" }}
                        onClick={fetchCryoETMetadata}
                        disabled={
                          isBusy || cryoETUploadInputs.cryoETId === undefined
                        }
                      >
                        Fetch Metadata
                      </Button>
                    </div>

                    {cryoETUploadInputs.hasSameId() && (
                      <div>
                        <Checkmark24Filled
                          className={globalClasses.successIcon}
                        />
                        <Text style={{ marginLeft: "5px" }}>
                          Successfully fetched metadata.
                        </Text>
                      </div>
                    )}
                    {cryoETUploadInputs.hasDifferentId() && (
                      <div>
                        <Info24Regular className={globalClasses.warningIcon} />
                        <Text style={{ marginLeft: "5px" }}>
                          Metadata does not match the current id.
                        </Text>
                      </div>
                    )}
                  </div>
                  <div className={classes.inputRow}>
                    <Field label="Width" className={classes.dimensionsField}>
                      <Input
                        value={cryoETUploadInputs.width}
                        className={classes.dimensionsInput}
                        disabled={true}
                      />
                    </Field>
                    <Field label="Height" className={classes.dimensionsField}>
                      <Input
                        value={cryoETUploadInputs.height}
                        className={classes.dimensionsInput}
                        disabled={true}
                      />
                    </Field>
                    <Field label="Depth" className={classes.dimensionsField}>
                      <Input
                        value={cryoETUploadInputs.depth}
                        className={classes.dimensionsInput}
                        disabled={true}
                      />
                    </Field>
                  </div>
                  <div className={classes.inputRow}>
                    <Field
                      label="Name"
                      className={classes.dimensionsField}
                      style={{ flex: 1 }}
                    >
                      <Input
                        value={cryoETUploadInputs.name}
                        className={classes.dimensionsInput}
                        disabled={true}
                        appearance="underline"
                      />
                    </Field>
                  </div>
                </div>
              )}
            </DialogContent>
            <DialogActions style={{ marginLeft: "auto" }}>
              <Button
                appearance="secondary"
                onClick={onClose}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={confirmEffect}
                disabled={isBusy || !uploadDialog.isValid()}
              >
                {confirmText}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  }
);

export default VolumeUploadDialog;
