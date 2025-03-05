import {
  Button,
  makeStyles,
  tokens,
  Text,
  mergeClasses,
} from "@fluentui/react-components";
import {
  ArrowCircleLeft28Regular,
  BrainCircuit20Regular,
  ConvertRange20Regular,
  Cube20Regular,
  DesktopFlow20Regular,
} from "@fluentui/react-icons";
import globalStyles from "../../GlobalStyles";
import ProcessTiltSeriesDialog, {
  TiltSeriesOptions,
} from "../../shared/ProcessTiltSeriesDialog";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import Utils from "../../../functions/Utils";
import JSZip from "jszip";
import saveAs from "file-saver";

const useStyles = makeStyles({
  inferenceButtons: {
    height: "40px",
  },
  rawFileName: {
    color: tokens.colorNeutralForeground2,
    flex: "1",
  },
});

interface Props {
  open: boolean;
  close: () => void;
}

const Local = ({ open, close }: Props) => {
  const classes = useStyles();
  const globalClasses = globalStyles();

  const [tiltSeriesProccessing, setTiltSeriesProccessing] = useState(false);
  const [isTiltSeriesDialogOpen, setIsTiltSeriesDialogOpen] = useState(false);

  const [isInferenceOngoing, setIsInferenceOngoing] = useState(false);
  const inferenceRawDataRef = useRef<HTMLInputElement | null>(null);
  const [inferenceRawDataFile, setInferenceRawDataFile] = useState<File | null>(
    null
  );
  const [inferenceRawDataSettings, setInferenceRawDataSettings] =
    useState<File | null>(null);
  const inferenceCheckpointRef = useRef<HTMLInputElement | null>(null);
  const [inferenceCheckpointFile, setInferenceCheckpointFile] =
    useState<File | null>(null);

  const isPageBusy = () => {
    return tiltSeriesProccessing || isInferenceOngoing;
  };

  const processTiltSeries = async (file: File, options: TiltSeriesOptions) => {
    let toastId = null;

    try {
      setTiltSeriesProccessing(true);

      if (!file) {
        return;
      }

      toastId = toast.loading("Processing data...");

      const { parsedSettings, fileData } =
        await Utils.convertTiltSeriesToRawData(file, options.volume_depth);

      toast.update(toastId, {
        render: "Preparing data for download...",
        isLoading: true,
        autoClose: false,
      });

      const baseName = Utils.removeExtensionFromPath(parsedSettings.file);

      const zip = new JSZip();
      zip.file(
        baseName + ".json",
        new Blob([JSON.stringify(parsedSettings, null, 2)], {
          type: "application/json",
        })
      );
      zip.file(
        parsedSettings.file,
        new Blob([fileData], {
          type: "application/octet-stream",
        })
      );

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${baseName}.zip`);

      toast.update(toastId, {
        render: "Data successfully processed!",
        type: "success",
        isLoading: false,
        autoClose: 2000,
        closeOnClick: true,
      });
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Error:", error);
      throw error;
    } finally {
      setTiltSeriesProccessing(false);
    }
  };

  const inferenceRawDataFileChange = async (event: FileChangeEvent) => {
    if (!event.target?.files || event.target.files.length < 1) {
      return;
    }

    const fileMap = await Utils.unpackAndcreateFileMap(event.target.files);

    let foundRaw = false;
    let foundSettings = false;

    fileMap.forEach((file, filename) => {
      if (!foundRaw && filename.endsWith(".raw")) {
        foundRaw = true;
        setInferenceRawDataFile(file);
      } else if (!foundSettings && filename.endsWith(".json")) {
        foundSettings = true;
        setInferenceRawDataSettings(file);
      }
    });
  };

  const inferenceCheckpointFileChange = (event: FileChangeEvent) => {
    if (!event.target?.files || event.target.files.length < 1) {
      setInferenceCheckpointFile(null);
      return;
    }
    const file = event.target.files[0];
    if (file) {
      setInferenceCheckpointFile(file);
    }
  };

  const startInferenceLocal = async () => {
    if (
      !inferenceRawDataFile ||
      !inferenceRawDataSettings ||
      !inferenceCheckpointFile ||
      isPageBusy()
    ) {
      return;
    }
    let toastId = null;
    try {
      if (!window.WasmModule) {
        throw new Error("Wasm module not initialized!");
      }

      setIsInferenceOngoing(true);

      toastId = toast.loading("Loading raw data...");

      const arrayBuffer = await Utils.readFileAsArrayBuffer(
        inferenceRawDataFile
      );
      if (!arrayBuffer) {
        throw new Error("Failed to read raw data file.");
      }
      const rawData = new Uint8Array(arrayBuffer);

      const settingsFile = await Utils.readFileAsText(inferenceRawDataSettings);
      if (!settingsFile) {
        throw new Error("Failed to read the settings file.");
      }
      const settings = JSON.parse(settingsFile);

      const settingsFileName = settings.file.replace(/\.[^/.]+$/, "") + ".json";

      toast.update(toastId, {
        render: "Running Local Inference...",
        isLoading: true,
        autoClose: false,
      });
      // This allows the toast to update, hopefully...
      await new Promise((r) => setTimeout(r, 1000));

      window.WasmModule?.FS.writeFile(settingsFileName, settingsFile);

      window.WasmModule?.FS.writeFile(settings.file, rawData);

      const formData = new FormData();
      formData.append("checkpoint", inferenceCheckpointFile);

      const response = await Utils.sendReq(
        `checkpoint/to-text`,
        {
          method: "POST",
          body: formData,
        },
        false
      );

      const checkpointTxt = await response.text();
      window.WasmModule?.FS.writeFile("parameters.txt", checkpointTxt);

      const volumeData = await window.WasmModule?.doInference(
        settingsFileName,
        "parameters.txt"
      );

      const zip = new JSZip();

      const settingFileList = new Array(volumeData.length + 1);

      toast.update(toastId, {
        render: "Creating mean-filtered volume...",
        isLoading: true,
        autoClose: false,
      });
      await new Promise((r) => setTimeout(r, 1000));

      const kernel = Array.from({ length: 3 }, () =>
        Array.from({ length: 3 }, () => Array(3).fill(1 / 27))
      );

      const meanFilteredInput = Utils.convolve3D(
        rawData,
        settings.size.x,
        settings.size.y,
        settings.size.z,
        kernel
      );

      const meanFilteredRawFileName = "meanFiltered.raw";
      zip.file(meanFilteredRawFileName, meanFilteredInput);

      const meanFilteredSettings = { ...settings };
      meanFilteredSettings.file = meanFilteredRawFileName;
      meanFilteredSettings.transferFunction = "tf-raw.json";
      const meanFilteredSettingsFileName = "meanFiltered.json";
      settingFileList[3] = meanFilteredSettingsFileName;
      zip.file(
        meanFilteredSettingsFileName,
        JSON.stringify(meanFilteredSettings, null, 2),
        { compression: "DEFLATE", compressionOptions: { level: 9 } }
      );

      toast.update(toastId, {
        render: "Preparing files for download...",
        isLoading: true,
        autoClose: false,
      });

      for (const [i, volume] of volumeData.entries()) {
        const fileName = `volume_${i}`;
        const rawFileName = `${fileName}.raw`;
        const parsedVolume = new Uint8Array(volume);
        zip.file(rawFileName, parsedVolume, {
          compression: "DEFLATE",
          compressionOptions: { level: 9 },
        });

        const settingsFileName = `${fileName}.json`;
        const volSettings = { ...settings };
        volSettings.file = rawFileName;
        switch (i) {
          case 0:
            volSettings.transferFunction = "tf-Background.json";
            settingFileList[4] = settingsFileName;
            break;
          case 1:
            volSettings.transferFunction = "tf-Membrane.json";
            settingFileList[1] = settingsFileName;
            break;
          case 2:
            volSettings.transferFunction = "tf-Spikes.json";
            settingFileList[0] = settingsFileName;
            break;
          case 3:
            volSettings.transferFunction = "tf-Inner.json";
            settingFileList[2] = settingsFileName;
            break;
        }

        zip.file(settingsFileName, JSON.stringify(volSettings, null, 2));
      }

      zip.file(
        "config.json",
        JSON.stringify({ files: settingFileList, rawVolumeChannel: 3 }, null, 2)
      );

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "result.zip");

      toast.update(toastId, {
        render: "Local Inference Successful!",
        type: "success",
        isLoading: false,
        autoClose: 2000,
        closeOnClick: true,
      });
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Local Inference Error:", error);
    } finally {
      setIsInferenceOngoing(false);
    }
  };

  return open ? (
    <div className={globalClasses.leftSidebar}>
      <div className={globalClasses.sidebarContents}>
        <div className={globalClasses.sidebarHeader}>
          <h1>Local Functions</h1>
          <div
            onClick={close}
            className={globalClasses.closeSidebarIconContainer}
          >
            <ArrowCircleLeft28Regular
              className={globalClasses.closeSidebarIcon}
            />
          </div>
        </div>
        <div className={globalClasses.siderbarBody}>
          <h2 className={globalClasses.sectionTitle}>Tilt Series</h2>
          <Button
            className={globalClasses.actionButton}
            disabled={isPageBusy()}
            onClick={() => setIsTiltSeriesDialogOpen(true)}
            style={{ minWidth: "70%", width: "70%" }}
          >
            <div className={globalClasses.actionButtonIconContainer}>
              <ConvertRange20Regular />
            </div>
            <div className="buttonText">Open Tilt Series Conversion Menu</div>
          </Button>
          <ProcessTiltSeriesDialog
            open={isTiltSeriesDialogOpen}
            onClose={() => setIsTiltSeriesDialogOpen(false)}
            onSubmit={processTiltSeries}
          />
          <hr
            style={{
              margin: "12px 0",
              border: "1px solid",
              borderColor: tokens.colorNeutralBackground1Hover,
            }}
          />
          <h2 className={globalClasses.sectionTitle}>Neural Model Inference</h2>
          <div style={{ display: "flex", columnGap: "20px" }}>
            <Button
              onClick={() => inferenceRawDataRef.current?.click()}
              appearance="secondary"
              className={mergeClasses(
                globalClasses.actionButton,
                classes.inferenceButtons
              )}
              style={{ width: "200px" }}
            >
              <div className={globalClasses.actionButtonIconContainer}>
                <Cube20Regular />
              </div>

              <div className="buttonText">Select Raw Data Files</div>
            </Button>
            {!inferenceRawDataFile && !inferenceRawDataSettings ? (
              <Text
                className={classes.rawFileName}
                style={{
                  alignSelf: "center",
                }}
              >
                No files selected.
              </Text>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignContent: "flex-start",
                }}
              >
                <Text className={classes.rawFileName}>
                  {inferenceRawDataFile
                    ? inferenceRawDataFile.name
                    : "No Raw Data file selected."}
                </Text>
                <Text className={classes.rawFileName}>
                  {inferenceRawDataSettings
                    ? inferenceRawDataSettings.name
                    : "No settings file selected."}
                </Text>
              </div>
            )}
          </div>

          <input
            ref={inferenceRawDataRef}
            type="file"
            accept=".raw, .json, .zip"
            style={{ display: "none" }}
            multiple={true}
            onChange={inferenceRawDataFileChange}
          />

          <div style={{ display: "flex", columnGap: "20px" }}>
            <Button
              onClick={() => inferenceCheckpointRef.current?.click()}
              appearance="secondary"
              className={mergeClasses(
                globalClasses.actionButton,
                classes.inferenceButtons
              )}
              style={{ width: "200px" }}
            >
              <div className={globalClasses.actionButtonIconContainer}>
                <BrainCircuit20Regular />
              </div>

              <div className="buttonText">Select Checkpoint File</div>
            </Button>

            <Text
              style={{
                alignSelf: "center",
                color: tokens.colorNeutralForeground2,
                flex: "1",
              }}
            >
              {inferenceCheckpointFile
                ? inferenceCheckpointFile.name?.substring(0, 50)
                : "No file selected."}
            </Text>
          </div>

          <input
            ref={inferenceCheckpointRef}
            type="file"
            accept=".ckpt"
            style={{ display: "none" }}
            onChange={inferenceCheckpointFileChange}
          />

          <Button
            appearance="primary"
            className={globalClasses.actionButton}
            disabled={
              isPageBusy() ||
              !inferenceRawDataFile ||
              !inferenceRawDataSettings ||
              !inferenceCheckpointFile
            }
            onClick={startInferenceLocal}
            style={{ width: "70%" }}
          >
            <div className={globalClasses.actionButtonIconContainer}>
              <DesktopFlow20Regular />
            </div>
            <div className="buttonText">Begin Model Inference</div>
          </Button>
        </div>
      </div>
    </div>
  ) : null;
};

export default Local;
