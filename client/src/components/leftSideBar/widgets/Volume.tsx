import {
  makeStyles,
  tokens,
  Button,
  Tooltip,
  mergeClasses,
  Menu,
  MenuTrigger,
  MenuButton,
  MenuPopover,
  MenuList,
  MenuItem,
  Switch,
  Text,
} from "@fluentui/react-components";
import {
  Add24Regular,
  AddFilled,
  ArrowCircleLeft28Regular,
  ArrowDownload20Regular,
  ArrowSync24Regular,
  ArrowUpload20Regular,
  Checkmark16Filled,
  Delete20Regular,
  EditSettings24Regular,
  ErrorCircle16Filled,
  ProjectionScreen20Regular,
  ProjectionScreenText24Regular,
  Stack24Regular,
} from "@fluentui/react-icons";
import { useState, useRef } from "react";
import CreateVolumeDialog from "./elements/CreateVolumeDialog";
import ItemTitleDownloadDelete from "../../shared/ItemTitleDownloadDelete";
import * as Utils from "../../../utils/Helpers";
import DeleteDialog from "../../shared/DeleteDialog";
import { CONFIG } from "../../../Constants.mjs";
import "../../../App.css";
import globalStyles from "../../GlobalStyles";
import ComboboxSearch from "../../shared/ComboboxSearch";
import ProcessTiltSeriesDialog, {
  TiltSeriesOptions,
} from "../../shared/ProcessTiltSeriesDialog";
import { observer } from "mobx-react-lite";
import { useMst } from "../../../stores/RootStore";
import {
  LabeledVolumeTypes,
  VolumeInstance,
} from "../../../stores/userState/VolumeModel";
import {
  WriteAccessTooltipContent,
  WriteAccessTooltipContentWrapper,
} from "../../shared/WriteAccessTooltip";
import { ResultInstance } from "../../../stores/userState/ResultModel";
import { VolumeSettings } from "../../../utils/VolumeSettings";
import VolumeUploadDialog from "../../shared/VolumeUploadDialog";
import { SparseVolumeInstance } from "../../../stores/userState/SparseVolumeModel";
import { PseudoVolumeInstance } from "../../../stores/userState/PseudoVolumeModel";
import { VolVisSettingsSnapshotIn } from "../../../stores/uiState/VolVisSettings";
import { VisualizedVolumeSnapshotIn } from "../../../stores/uiState/VisualizedVolume";
import { DEFAULT_TF } from "../../../DefaultTransferFunctions";
import { queuePseudoLabelsGeneration } from "../../../api/ilastik";
import { queueTiltSeriesReconstruction } from "../../../api/cryoEt";
import {
  downloadFullVolumeData,
  getVolumeVisualizationFiles,
} from "../../../api/volumeData";
import { getResultData } from "../../../api/results";
import { FileTypeOptions } from "../../../stores/uiState/UploadDialog";
import ToastContainer from "../../../utils/ToastContainer";

const useStyles = makeStyles({
  visualizeButton: {
    width: "115px",
    "&:enabled": {
      border: 0,
    },
  },
  uploadDownloadButtom: {
    width: "188px",
  },
});

type RawDataTypes = "RawVolumeData" | LabeledVolumeTypes;

interface Props {
  open: boolean;
  close: () => void;
}

const Volume = observer(({ open, close }: Props) => {
  const { user, uiState } = useMst();

  const activeProject = user?.userProjects.activeProject;
  const projectVolumes = activeProject?.projectVolumes;
  const selectedVolumeId = projectVolumes?.selectedVolumeId;
  const selectedVolume = projectVolumes?.selectedVolume;
  const volumeResults = selectedVolume?.volumeResults;
  const selectedResultId = volumeResults?.selectedResultId;
  const selectedResult = volumeResults?.selectedResult;
  const results = selectedVolume?.volumeResults.results;
  const visualizedVolume = uiState.visualizedVolume;

  const classes = useStyles();
  const globalClasses = globalStyles();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDeleteResultDialogOpen, setDeleteResultDialogOpen] = useState(false);
  const [isLoadingResults, setLoadingResults] = useState(false);
  const [isLoadingVolumes, setLoadingVolumes] = useState(false);
  const [isUploadingData, setIsUploadingData] = useState(false);
  const [isTiltSeriesDialogOpen, setIsTiltSeriesDialogOpen] = useState(false);
  const [isUploadVolumeDialogOpen, setIsUploadVolumeDialogOpen] =
    useState(false);

  const sparseLabelFileRef = useRef<HTMLInputElement | null>(null);
  const pseudoLabelFileRef = useRef<HTMLInputElement | null>(null);

  const isPageBusy = () => {
    return (
      isLoadingResults ||
      isLoadingVolumes ||
      isUploadingData ||
      uiState.uploadDialog.isBusy
    );
  };

  const handleVolumeSelect = async (value: string | null) => {
    try {
      if (!value) {
        return;
      }

      projectVolumes?.setSelectedVolumeId(Number(value));
    } catch (error) {
      console.error(error);
      const toastContainer = new ToastContainer();
      toastContainer.error(Utils.getErrorMessage(error));
    }
  };

  const createVolume = () => {
    setCreateDialogOpen(true);
  };

  const openDeleteDialog = () => {
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
  };

  const handleCloseCheckpointDialog = () => {
    setDeleteResultDialogOpen(false);
  };

  const confirmDeleteVolume = async () => {
    if (!selectedVolumeId) {
      return;
    }
    const toastContainer = new ToastContainer();
    try {
      projectVolumes.setRemoveVolumeActiveRequest(true);
      await projectVolumes.removeVolume(selectedVolumeId);
      closeDeleteDialog();
      toastContainer.success("Volume removed from project!");
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(Utils.getErrorMessage(error));
    }
    projectVolumes.setRemoveVolumeActiveRequest(false);
  };

  const handleCreateVolume = async (name: string, description: string) => {
    if (projectVolumes === undefined) {
      return;
    }
    const toastContainer = new ToastContainer();
    try {
      projectVolumes.setCreateVolumeActiveRequest(true);
      await projectVolumes.createVolume(name, description);
      closeCreateDialog();
      toastContainer.success("Volume created!")
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(Utils.getErrorMessage(error));
    }
    projectVolumes.setCreateVolumeActiveRequest(false);
  };

  const uploadRawData = async (
    pendingFile: File,
    volumeSettings?: VolumeSettings
  ) => {
    const toastContainer = new ToastContainer();
    try {
      toastContainer.loading("Uploading files...");
      if (Utils.isMrcFile(pendingFile.name)) {
        try {
          await selectedVolume?.uploadMrcVolume(pendingFile);
        } catch (error) {
          if (error instanceof Error) {
            throw new Error("Error converting MRC file:" + error.message);
          } else {
            throw new Error("Error converting MRC file.");
          }
        }
      } else {
        if (!Utils.isRawFile(pendingFile.name)) {
          throw new Error("No .raw file found in the uploaded files.");
        }

        if (!volumeSettings) {
          throw new Error("Missing volume settings.");
        }

        volumeSettings.checkValidity();

        await Utils.waitForNextFrame();
        await selectedVolume?.uploadRawVolume(pendingFile, volumeSettings);
      }
      toastContainer.success("Data uploaded!");
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      console.error("Error:", error);
    }
  };

  const uploadUrl = async (
    url: string,
    fileType: FileTypeOptions,
    volumeSettings?: VolumeSettings
  ) => {
    const toastContainer = new ToastContainer();
    try {
      toastContainer.loading("Uploading files...");
      await selectedVolume?.uploadFromUrl(url, fileType, volumeSettings);
      toastContainer.success("Data successfully uploaded!");
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      console.error("Error:", error);
    }
  };

  const tiltSeriesUpload = async (
    file: File,
    options: TiltSeriesOptions,
    toastContainer: ToastContainer,
    serverSide?: boolean
  ) => {
    if (!selectedVolumeId) {
      return;
    }

    try {
      setIsUploadingData(true);

      if (serverSide) {
        if (!file) {
          throw new Error("No file found.");
        }

        if (!file.name.endsWith(".ali") && !file.name.endsWith(".mrc")) {
          throw new Error("Wrong file format.");
        }

        const formData = new FormData();
        formData.append("tiltSeries", file);
        formData.append(
          "data",
          JSON.stringify({
            volumeId: selectedVolumeId,
            options: options,
          })
        );
        queueTiltSeriesReconstruction(formData);
        toastContainer.success(
          "Tilt series reconstruction successfuly queued!"
        );
      } else {
        toastContainer.loading(
          "Performing local tilt series reconstruction..."
        );

        await Utils.waitForNextFrame();
        const { parsedSettings, fileData } =
          await Utils.convertTiltSeriesToRawData(
            file,
            options.reconstruction.volume_depth
          );
        toastContainer.loading("Uploading data to the server...");

        await Utils.waitForNextFrame();

        await selectedVolume?.uploadTiltSeries(parsedSettings, fileData);

        toastContainer.success("Data successfully uploaded!");
      }
    } catch (error) {
      console.error("Error:", error);
      throw error;
    } finally {
      setIsUploadingData(false);
    }
  };

  const handleVisualisationRequest = async (
    dataType: RawDataTypes,
    id: number | undefined,
    volumeInstance:
      | VolumeInstance
      | SparseVolumeInstance
      | PseudoVolumeInstance
      | undefined
  ) => {
    if (!volumeInstance || !id) {
      return;
    }

    const toastContainer = new ToastContainer();

    try {
      toastContainer.loading("Fetching visualization data...");

      const contents = await getVolumeVisualizationFiles(dataType, id);

      toastContainer.loading("Processing visualization data...");

      const fileMap = await Utils.zipToFileMap(contents);

      await uiState.visualizeVolume(fileMap, volumeInstance);

      toastContainer.dismiss();
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      console.error("Error:", error);
    }
  };

  const visualizeLabelVolumes = async (
    volume: VolumeInstance | undefined,
    dataType: "SparseLabeledVolumeData" | "PseudoLabeledVolumeData"
  ) => {
    const toastContainer = new ToastContainer();

    try {
      if (!volume) {
        throw new Error("No volume selected.");
      }

      toastContainer.loading(
        `Fetching manual label volume 0/${volume.sparseVolumeArray.length}`
      );

      if (!window.WasmModule) {
        throw new Error("WasmModule is not loaded.");
      }

      const volumeVisualizationSettingsArray: Array<VolVisSettingsSnapshotIn> =
        [];

      const vizualizedVolume: VisualizedVolumeSnapshotIn = {
        volVisSettings: volumeVisualizationSettingsArray,
      };

      const config = {
        files: [] as string[],
      };

      let volumeArray;
      if (dataType === "SparseLabeledVolumeData") {
        volumeArray = volume.sparseVolumeArray;
        vizualizedVolume.sparseLabelVolumes = volumeArray.map(
          (sparseVolume) => sparseVolume.id
        );
      }
      if (dataType === "PseudoLabeledVolumeData") {
        volumeArray = volume.pseudoVolumeArray;
        vizualizedVolume.PseudoLabelVolumes = volumeArray.map(
          (pseudoVolume) => pseudoVolume.id
        );
      }

      if (!volumeArray || volumeArray.length === 0) {
        throw new Error("No manual label volumes found.");
      }

      const type = dataType === "SparseLabeledVolumeData" ? "Manual" : "Pseudo";

      for (let i = 0; i < volumeArray.length; i++) {
        const labelVolume = volumeArray[i];
        toastContainer.loading(
          `Fetching ${type} label volume ${i + 1}/${volumeArray.length}`
        );

        await Utils.waitForNextFrame();

        const contents = await downloadFullVolumeData(dataType, labelVolume.id);
        const fileMap = await Utils.zipToFileMap(contents);
        let settingsFile;
        let rawFile;
        for (const [key, value] of fileMap) {
          if (key.endsWith(".json")) {
            settingsFile = value;
          } else if (key.endsWith(".raw")) {
            rawFile = value;
          }
        }
        if (!settingsFile || !rawFile) {
          throw new Error("No annotation volume found.");
        }
        const settingsData = await settingsFile.text();
        const settings = JSON.parse(settingsData);
        const settingsFileName = `settings_${i}.json`;
        const rawFileName = `raw_${i}.raw`;
        settings.file = rawFileName;

        const rawFileContent = await rawFile.arrayBuffer();
        const data = new Uint8Array(rawFileContent);

        let color;

        if ("color" in labelVolume) {
          color = labelVolume.color
            ? Utils.fromHexColor(labelVolume.color as string)
            : { r: 255, g: 255, b: 255 };
        } else {
          const colorTF = DEFAULT_TF.tfArray[i].color;
          color = {
            r: colorTF.x,
            g: colorTF.y,
            b: colorTF.z,
          };
        }

        const tfName = `transferFunction_${i}`;

        const volumeVisualizationSettings: VolVisSettingsSnapshotIn = {
          index: i,
          name: `Annotation ${i}`,
          type: "volume",
          transferFunction: {
            rampLow: 0.01,
            rampHigh: 0.99,
            red: color.r,
            green: color.g,
            blue: color.b,
            comment: tfName,
          },
        };

        settings.transferFunction = tfName;

        window.WasmModule?.FS.writeFile(rawFileName, data);
        window.WasmModule?.FS.writeFile(
          settingsFileName,
          JSON.stringify(settings)
        );
        window.WasmModule?.FS.writeFile(
          tfName,
          JSON.stringify({
            rampLow: volumeVisualizationSettings.transferFunction.rampLow,
            rampHigh: volumeVisualizationSettings.transferFunction.rampHigh,
            color: {
              x: volumeVisualizationSettings.transferFunction.red,
              y: volumeVisualizationSettings.transferFunction.green,
              z: volumeVisualizationSettings.transferFunction.blue,
            },
          })
        );

        config.files.push(settingsFileName);
        volumeVisualizationSettingsArray.push(volumeVisualizationSettings);
      }

      toastContainer.loading("Processing rendering data...");

      await Utils.waitForNextFrame();

      window.WasmModule?.FS.writeFile("config.json", JSON.stringify(config));
      window.WasmModule?.open_volume();
      uiState.setVizualizedVolume(vizualizedVolume);

      toastContainer.success(`${type} label volumes visualized.`);
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      console.error("Error:", error);
    }
  };

  // dataType options = 'RawVolumeData', 'SparseLabeledVolumeData', 'PseudoLabeledVolumeData'.
  const handleResultVisualisationRequest = async () => {
    if (selectedResultId === undefined) {
      return;
    }
    const toastContainer = new ToastContainer();

    try {
      toastContainer.loading("Fetching visualization data...");

      const contents = await getResultData(selectedResultId);
      const fileMap = await Utils.zipToFileMap(contents);

      await uiState.visualizeVolume(fileMap, selectedResult);

      toastContainer.dismiss();
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      console.error("Error:", error);
    }
  };

  const queuePseudoLabelGeneration = async () => {
    if (selectedVolumeId === undefined) {
      return;
    }
    const toastContainer = new ToastContainer();
    try {
      toastContainer.loading("Creating pseudo label volumes...");
      await queuePseudoLabelsGeneration(selectedVolumeId);
      toastContainer.success("Label generation queued!");
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(Utils.getErrorMessage(error));
    }
  };

  const refreshVolumes = async () => {
    try {
      setLoadingVolumes(true);
      await projectVolumes?.refreshVolumes();
    } catch (error) {
      console.error("Error:", error);
      const toastContainer = new ToastContainer();
      toastContainer.error(Utils.getErrorMessage(error));
    } finally {
      setLoadingVolumes(false);
    }
  };

  const handleSparseLabelFileChange = async (event: FileChangeEvent) => {
    const toastContainer = new ToastContainer();
//LOL
    try {
      if (!event.target.files) {
        throw Error("No files selected.");
      }
      setIsUploadingData(true);
      toastContainer.loading("Uploading manual label volume file(s)...");

      await selectedVolume?.uploadSparseLabelVolume(event.target.files);
      toastContainer.success("Manual label volume(s) uploaded!");
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(Utils.getErrorMessage(error));
    } finally {
      setIsUploadingData(false);
      if (sparseLabelFileRef.current) {
        sparseLabelFileRef.current.value = "";
      }
    }
  };

  const handlePseudoLabelFileChange = async (event: FileChangeEvent) => {
    if (!event.target.files) {
      return;
    }
    const toastContainer = new ToastContainer();

    try {
      toastContainer.loading("Uploading pseudo label volume(s)...");
      setIsUploadingData(true);
      await selectedVolume?.uploadPseudoLabelVolume(event.target.files);
      toastContainer.success("Pseudo label Volume uploaded!");
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(Utils.getErrorMessage(error));
    } finally {
      setIsUploadingData(false);
      if (pseudoLabelFileRef.current) {
        pseudoLabelFileRef.current.value = "";
      }
    }
  };

  const handleVolumeDataConfirmDelete = async (
    dataType: LabeledVolumeTypes,
    dataId: number | undefined
  ) => {
    if (!dataId) {
      return;
    }
    const toastContainer = new ToastContainer();

    try {
      selectedVolume?.setVolumeDataConfirmDeleteActiveRequest(true);
      await selectedVolume?.deleteLabeledVolume(dataType, dataId);
      if (dataType === "SparseLabeledVolumeData") {
        visualizedVolume?.setLabelEditingMode(false);
      }
      toastContainer.success("Volume data deleted.");
    } catch (error) {
      console.error("Error:", error);
      const toastContainer = new ToastContainer();
      toastContainer.error(Utils.getErrorMessage(error));
    }
    selectedVolume?.setVolumeDataConfirmDeleteActiveRequest(false);
  };

  // Download handlers
  const handleDownloadVolumeData = async (
    dataType: RawDataTypes,
    id: number | undefined
  ) => {
    try {
      if (!id) {
        return;
      }
      await Utils.downloadFileFromServer(
        `volumeData/${dataType}/${id}/download-full`
      );
    } catch (error) {
      console.error("Error:", error);
      const toastContainer = new ToastContainer();
      toastContainer.error(Utils.getErrorMessage(error));
    }
  };

  const canEditAnnotations =
    visualizedVolume !== undefined &&
    visualizedVolume.canEditLabels &&
    visualizedVolume.labelEditingMode &&
    selectedVolume !== undefined &&
    visualizedVolume.volume?.id === selectedVolume.id;

  const handleAnnotationEdit = async (index: number) => {
    if (!canEditAnnotations) {
      return;
    }
    visualizedVolume.setManualLabelIndex(index);
  };

  //Function to handle Result Checks
  const handleResultSelect = (value: string | null) => {
    if (!value) {
      return;
    }

    try {
      volumeResults?.setSelectedResultId(Number(value));
    } catch (error) {
      console.error("Error:", error);
      const toastContainer = new ToastContainer();
      toastContainer.error(Utils.getErrorMessage(error));
    }
  };

  //Functions to handle result buttons
  const handleDownloadResultFiles = async () => {
    try {
      if (!selectedResultId) {
        return;
      }

      await Utils.downloadFileFromServer(`result/${selectedResultId}/data`);
    } catch (error) {
      console.error("Error:", error);
      const toastContainer = new ToastContainer();
      toastContainer.error(Utils.getErrorMessage(error));
    }
  };

  const removeResult = async () => {
    if (!selectedResultId) {
      return;
    }
    const toastContainer = new ToastContainer();

    try {
      volumeResults.setRemoveResultActiveRequest(true);
      await volumeResults.removeResult(selectedResultId);
      setDeleteResultDialogOpen(false);
      toastContainer.success("Result deleted!");
    } catch (error) {
      console.error("Error", error);
      toastContainer.error(Utils.getErrorMessage(error));
    }
    volumeResults.setRemoveResultActiveRequest(false);
  };

  const refreshVolumeResultsData = async () => {
    try {
      setLoadingResults(true);
      await volumeResults?.refreshResults();
    } catch (error) {
      console.error(error);
      const toastContainer = new ToastContainer();
      toastContainer.error(Utils.getErrorMessage(error));
    } finally {
      setLoadingResults(false);
    }
  };

  const hasRawData = () => {
    return selectedVolume?.rawData;
  };

  const canUploadRawData = () => {
    return selectedVolume && !hasRawData();
  };

  const isVolumeSelected = () => {
    return selectedVolume;
  };

  const resultActionsDisabled = () => {
    return !selectedVolume || isPageBusy();
  };

  const volumeSelectionProperties = (volume: VolumeInstance) => {
    return {
      children: volume.name,
      value: volume.id.toString(),
      tooltip: (
        <div className={globalClasses.selectionDropdownTooltip}>
          <b>ID:</b> {volume.id}
          {volume.description.length > 0 && (
            <>
              <br />
              <b>Description:</b> {volume?.description}
            </>
          )}
        </div>
      ),
    };
  };

  const volumeSelectionList = () => {
    const selectionList: Array<{
      children: string;
      value: string;
      tooltip: JSX.Element;
    }> = [];
    projectVolumes?.volumes.forEach((volume) =>
      selectionList.push(volumeSelectionProperties(volume))
    );
    return selectionList;
  };

  const resultSelectionProperties = (result: ResultInstance) => {
    return {
      children: `Result ${result.id}`,
      value: result.id.toString(),
      tooltip: (
        <div className={globalClasses.selectionDropdownTooltip}>
          <b>ID:</b> {result.id}
          <br />
          <b>Checkpoint:</b>{" "}
          {Utils.getFileNameFromPath(result?.checkpoint?.filePath)}
        </div>
      ),
    };
  };

  const resultSelectionList = () => {
    const selectionList: Array<{
      children: string;
      value: string;
      tooltip: JSX.Element;
    }> = [];
    results?.forEach((result) =>
      selectionList.push(resultSelectionProperties(result))
    );
    return selectionList;
  };

  const canActivateEditingMode = () => {
    return selectedVolume && visualizedVolume && visualizedVolume.canEditLabels;
  };

  return open ? (
    <div className={globalClasses.leftSidebar}>
      <div className={globalClasses.sidebarContents}>
        <div className={globalClasses.sidebarHeader}>
          <h1>Data</h1>
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
          <h2 className={globalClasses.sectionTitle}>Volume</h2>

          {/* Dropdown for selecting project volumes */}
          <div className={globalClasses.drowdownActionsContainer}>
            <ComboboxSearch
              selectionList={volumeSelectionList()}
              selectedOption={
                selectedVolume
                  ? volumeSelectionProperties(selectedVolume)
                  : undefined
              }
              onOptionSelect={handleVolumeSelect}
              placeholder="Select a volume"
              noOptionsMessage="No volumes match your search."
              className={globalClasses.selectionDropdown}
              disabled={
                isPageBusy() ||
                !projectVolumes ||
                projectVolumes?.volumes.size === 0
              }
            />
            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={"Add a New Volume"}
                  hasWriteAccess={activeProject?.hasWriteAccess}
                />
              }
              relationship="label"
              hideDelay={0}
            >
              <Button
                className={globalClasses.sideActionButton}
                appearance="subtle"
                icon={<AddFilled />}
                disabled={isPageBusy() || !activeProject?.hasWriteAccess}
                onClick={createVolume}
              />
            </Tooltip>
            <Tooltip
              content="Refresh Volume Data"
              relationship="label"
              hideDelay={0}
            >
              <Button
                className={globalClasses.sideActionButton}
                appearance="subtle"
                icon={
                  <ArrowSync24Regular
                    className={mergeClasses(
                      isLoadingVolumes && "spinning-icon"
                    )}
                  />
                }
                disabled={isPageBusy()}
                onClick={refreshVolumes}
              />
            </Tooltip>
          </div>
          <div className={globalClasses.actionButtonRow}>
            {!isVolumeSelected() || canUploadRawData() ? (
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <MenuButton
                    disabled={
                      !canUploadRawData() || !activeProject?.hasWriteAccess
                    }
                    appearance="primary"
                    className={mergeClasses(
                      globalClasses.actionButtonDropdown,
                      classes.uploadDownloadButtom
                    )}
                  >
                    <div className={globalClasses.actionButtonIconContainer}>
                      <ArrowUpload20Regular />
                    </div>
                    <div className="buttonText">Upload Raw Data</div>
                  </MenuButton>
                </MenuTrigger>

                <MenuPopover>
                  <MenuList>
                    <MenuItem
                      disabled={isPageBusy() || !activeProject?.hasWriteAccess}
                      onClick={() => setIsUploadVolumeDialogOpen(true)}
                    >
                      Raw Data
                    </MenuItem>
                    <MenuItem
                      disabled={isPageBusy() || !activeProject?.hasWriteAccess}
                      onClick={() => setIsTiltSeriesDialogOpen(true)}
                    >
                      Tilt Series
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            ) : (
              <Button
                appearance="secondary"
                className={mergeClasses(
                  globalClasses.actionButton,
                  classes.uploadDownloadButtom
                )}
                disabled={!hasRawData() || isPageBusy()}
                onClick={() =>
                  handleDownloadVolumeData(
                    "RawVolumeData",
                    selectedVolume?.rawData?.id
                  )
                }
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <ArrowDownload20Regular />
                </div>
                <div className="buttonText">Download Raw Data</div>
              </Button>
            )}

            <Tooltip
              content="Visualize Raw Data"
              relationship="label"
              appearance="inverted"
              hideDelay={0}
            >
              <Button
                appearance="primary"
                className={mergeClasses(
                  globalClasses.actionButton,
                  classes.visualizeButton
                )}
                disabled={!hasRawData() || isPageBusy()}
                onClick={() =>
                  handleVisualisationRequest(
                    "RawVolumeData",
                    selectedVolume?.rawData?.id,
                    selectedVolume
                  )
                }
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <ProjectionScreen20Regular />
                </div>
                <div className="buttonText">Visualize</div>
              </Button>
            </Tooltip>

            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={"Remove Volume from the Project"}
                  hasWriteAccess={activeProject?.hasWriteAccess}
                />
              }
              relationship="label"
              appearance="inverted"
              hideDelay={0}
            >
              <Button
                className={mergeClasses(
                  globalClasses.actionButton,
                  selectedVolume && globalClasses.actionButtonDelete
                )}
                disabled={
                  !selectedVolume ||
                  isPageBusy() ||
                  !activeProject?.hasWriteAccess
                }
                onClick={openDeleteDialog}
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <Delete20Regular />
                </div>
                <div className="buttonText">Remove</div>
              </Button>
            </Tooltip>
          </div>

          <ProcessTiltSeriesDialog
            open={isTiltSeriesDialogOpen}
            onClose={() => setIsTiltSeriesDialogOpen(false)}
            onSubmit={tiltSeriesUpload}
            showServerVariant={true}
            store={uiState.tiltSeriesDialogServer}
          />

          <VolumeUploadDialog
            open={isUploadVolumeDialogOpen}
            onClose={() => setIsUploadVolumeDialogOpen(false)}
            onFileConfirm={uploadRawData}
            titleText={"Upload Raw Data"}
            confirmText="Upload"
            uploadDialogStore={uiState.uploadDialog}
            onUrlConfirm={uploadUrl}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <h3
              className={globalClasses.subSectionTitle}
              style={{ marginRight: "auto" }}
            >
              Manual Labels
            </h3>
            <Tooltip
              content={{
                style: { maxWidth: "fit-content" },
                children: (
                  <>
                    <Text>Visualize All Sparse Label Volumes</Text>
                    <br />
                    {!projectVolumes?.canVisualizeSparseLabels ? (
                      <ErrorCircle16Filled className={globalClasses.failIcon} />
                    ) : (
                      <Checkmark16Filled
                        className={globalClasses.successIcon}
                      />
                    )}

                    <Text
                      style={{
                        marginLeft: "3px",
                        verticalAlign: "middle",
                        color: tokens.colorNeutralForeground2,
                      }}
                    >
                      Requires at least 1 Sparse Labeled Volume.
                    </Text>
                  </>
                ),
              }}
              relationship="label"
              hideDelay={0}
              appearance="inverted"
            >
              <Button
                className={globalClasses.mainActionButton}
                style={{
                  marginRight: "7px",
                }}
                size="large"
                appearance="subtle"
                icon={<ProjectionScreenText24Regular />}
                disabled={!projectVolumes?.canVisualizeSparseLabels}
                onClick={() =>
                  visualizeLabelVolumes(
                    selectedVolume,
                    "SparseLabeledVolumeData"
                  )
                }
              />
            </Tooltip>
            <Tooltip
              content={{
                style: { maxWidth: "fit-content" },
                children: (
                  <div>
                    <Text>Label Editing Mode</Text>
                    <br />
                    <div>
                      {!visualizedVolume || !visualizedVolume.canEditLabels ? (
                        <ErrorCircle16Filled
                          className={globalClasses.failIcon}
                        />
                      ) : (
                        <Checkmark16Filled
                          className={globalClasses.successIcon}
                        />
                      )}
                      <Text
                        style={{
                          marginLeft: "3px",
                          verticalAlign: "middle",
                          color: tokens.colorNeutralForeground2,
                        }}
                      >
                        Selected volume must be visualized.
                      </Text>
                    </div>
                  </div>
                ),
              }}
              relationship="label"
              hideDelay={0}
              appearance="inverted"
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <EditSettings24Regular
                  className={mergeClasses(
                    globalClasses.successIcon,
                    !canActivateEditingMode() && globalClasses.disabledIcon
                  )}
                />
                <Switch
                  checked={visualizedVolume?.labelEditingMode ?? false}
                  onChange={(_, data) => {
                    if (!visualizedVolume) {
                      return;
                    }
                    visualizedVolume.setLabelEditingMode(
                      data?.checked ?? false
                    );
                  }}
                  disabled={!canActivateEditingMode()}
                />
              </div>
            </Tooltip>
            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={"Add Manual Label Volume"}
                  hasWriteAccess={activeProject?.hasWriteAccess}
                />
              }
              relationship="label"
              hideDelay={0}
              appearance="inverted"
            >
              <Button
                className={globalClasses.sideActionButton}
                size="large"
                appearance="subtle"
                icon={<Add24Regular />}
                disabled={
                  !selectedVolume ||
                  selectedVolume?.sparseVolumes.size >= 4 ||
                  !activeProject?.hasWriteAccess
                }
                onClick={() => sparseLabelFileRef.current?.click()}
              />
            </Tooltip>
          </div>

          <input
            type="file"
            onChange={handleSparseLabelFileChange}
            accept=".raw, .json, .zip"
            multiple
            ref={sparseLabelFileRef}
            className={globalClasses.hiddenInput}
          />

          {Array.from({ length: CONFIG.maxLabels }, (_v, index) => (
            <div key={index}>
              {selectedVolume &&
              index < selectedVolume?.sparseVolumeArray.length ? (
                <ItemTitleDownloadDelete
                  title={Utils.getFileNameFromPath(
                    selectedVolume.sparseVolumeArray[index].rawFilePath
                  )}
                  highlighted={
                    visualizedVolume?.labelEditingMode &&
                    visualizedVolume?.manualLabelIndex === index
                  }
                  onDownload={() =>
                    handleDownloadVolumeData(
                      "SparseLabeledVolumeData",
                      selectedVolume.sparseVolumeArray[index].id
                    )
                  }
                  onVisualize={() =>
                    handleVisualisationRequest(
                      "SparseLabeledVolumeData",
                      selectedVolume.sparseVolumeArray[index].id,
                      selectedVolume.sparseVolumeArray[index]
                    )
                  }
                  onDelete={() =>
                    handleVolumeDataConfirmDelete(
                      "SparseLabeledVolumeData",
                      selectedVolume.sparseVolumeArray[index].id
                    )
                  }
                  onEdit={() => handleAnnotationEdit(index)}
                  canEdit={canEditAnnotations}
                  canChangeColor={canEditAnnotations}
                  deleteQuestion={Utils.getFileNameFromPath(
                    selectedVolume.sparseVolumeArray[index].rawFilePath
                  )}
                  deleteTitle={"Remove Sparse Volume Data?"}
                  preventChanges={!activeProject?.hasWriteAccess}
                  color={
                    selectedVolume.sparseVolumeArray[index].color ?? undefined
                  }
                  onColorChange={async (color) => {
                    await selectedVolume.sparseVolumeArray[index].setColor(
                      color,
                      index
                    );
                  }}
                  isEnabled={selectedVolume.shownAnnotations[index]}
                  onEnabled={() => {
                    selectedVolume.toggleShownAnnotation(index);
                  }}
                  isActive={
                    selectedVolume?.volumeDataConfirmDeleteActiveRequest
                  }
                />
              ) : (
                <ItemTitleDownloadDelete
                  inactive={true}
                  highlighted={
                    visualizedVolume?.labelEditingMode &&
                    visualizedVolume?.manualLabelIndex === index
                  }
                  onEdit={() => handleAnnotationEdit(index)}
                  canEdit={
                    canEditAnnotations &&
                    index === selectedVolume.sparseVolumeArray.length
                  }
                  canChangeColor={
                    canEditAnnotations &&
                    index === selectedVolume.sparseVolumeArray.length
                  }
                  color={selectedVolume?.sparseLabelColors[index] ?? "#000000"}
                  onColorChange={(color) => {
                    selectedVolume?.setSparseLabelColor(index, color);
                  }}
                  isEnabled={
                    selectedVolume === undefined ||
                    selectedVolume.shownAnnotations[index]
                  }
                  onEnabled={() => {
                    selectedVolume?.toggleShownAnnotation(index);
                  }}
                />
              )}
            </div>
          ))}

          {/* Horizontal Line */}
          <hr
            style={{
              margin: "2px 0",
              border: "1px solid",
              borderColor: tokens.colorNeutralBackground1Hover,
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <h3
              className={globalClasses.subSectionTitle}
              style={{ marginRight: "auto" }}
            >
              Pseudo Labels
            </h3>
            <Tooltip
              content={{
                style: { maxWidth: "fit-content" },
                children: (
                  <div>
                    <Text>Create Pseudo Label Volumes (Ilastik)</Text>
                    <br />
                    <div>
                      {!selectedVolume ||
                      selectedVolume?.sparseVolumeArray.length < 2 ? (
                        <ErrorCircle16Filled
                          className={globalClasses.failIcon}
                        />
                      ) : (
                        <Checkmark16Filled
                          className={globalClasses.successIcon}
                        />
                      )}

                      <Text
                        style={{
                          marginLeft: "3px",
                          verticalAlign: "middle",
                          color: tokens.colorNeutralForeground2,
                        }}
                      >
                        Requires at least 2 Manual Labels.
                      </Text>
                    </div>
                    <WriteAccessTooltipContent
                      hasWriteAccess={activeProject?.hasWriteAccess}
                    />
                  </div>
                ),
              }}
              relationship="label"
              hideDelay={0}
              appearance="inverted"
            >
              <Button
                className={globalClasses.mainActionButton}
                style={{}}
                size="large"
                appearance="subtle"
                icon={<Stack24Regular />}
                disabled={
                  !selectedVolume ||
                  selectedVolume?.sparseVolumeArray.length < 2 ||
                  selectedVolume?.sparseVolumeArray.length +
                    selectedVolume?.pseudoVolumeArray.length >
                    4 ||
                  !activeProject?.hasWriteAccess
                }
                onClick={queuePseudoLabelGeneration}
              />
            </Tooltip>
            <Tooltip
              content={{
                style: { maxWidth: "fit-content" },
                children: (
                  <>
                    <Text>Visualize All Pseudo Label Volumes</Text>
                    <br />
                    {!projectVolumes?.canVisualizePseudoLabels ? (
                      <ErrorCircle16Filled className={globalClasses.failIcon} />
                    ) : (
                      <Checkmark16Filled
                        className={globalClasses.successIcon}
                      />
                    )}

                    <Text
                      style={{
                        marginLeft: "3px",
                        verticalAlign: "middle",
                        color: tokens.colorNeutralForeground2,
                      }}
                    >
                      Requires at least 1 Pseudo Labeled Volume.
                    </Text>
                  </>
                ),
              }}
              relationship="label"
              hideDelay={0}
              appearance="inverted"
            >
              <Button
                className={globalClasses.mainActionButton}
                style={{
                  marginRight: "1px",
                }}
                size="large"
                appearance="subtle"
                icon={<ProjectionScreenText24Regular />}
                disabled={!projectVolumes?.canVisualizePseudoLabels}
                onClick={() =>
                  visualizeLabelVolumes(
                    selectedVolume,
                    "PseudoLabeledVolumeData"
                  )
                }
              />
            </Tooltip>
            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={"Add Pseudo Label Volume"}
                  hasWriteAccess={activeProject?.hasWriteAccess}
                />
              }
              relationship="label"
              hideDelay={0}
              appearance="inverted"
            >
              <Button
                className={globalClasses.mainActionButton}
                size="large"
                appearance="subtle"
                icon={<Add24Regular />}
                disabled={
                  !selectedVolume ||
                  selectedVolume?.pseudoVolumeArray.length >= 4 ||
                  !activeProject?.hasWriteAccess
                }
                onClick={() => pseudoLabelFileRef.current?.click()}
              />
            </Tooltip>
          </div>

          <input
            type="file"
            onChange={handlePseudoLabelFileChange}
            accept=".raw, .json, .zip"
            multiple
            ref={pseudoLabelFileRef}
            className={globalClasses.hiddenInput}
          />

          {Array.from({ length: CONFIG.maxLabels }, (_v, index) => (
            <div key={index}>
              {selectedVolume &&
              index < selectedVolume?.pseudoVolumeArray.length ? (
                <ItemTitleDownloadDelete
                  title={Utils.getFileNameFromPath(
                    selectedVolume?.pseudoVolumeArray[index].rawFilePath
                  )}
                  onDownload={() =>
                    handleDownloadVolumeData(
                      "PseudoLabeledVolumeData",
                      selectedVolume?.pseudoVolumeArray[index].id
                    )
                  }
                  onVisualize={() =>
                    handleVisualisationRequest(
                      "PseudoLabeledVolumeData",
                      selectedVolume?.pseudoVolumeArray[index].id,
                      selectedVolume?.pseudoVolumeArray[index]
                    )
                  }
                  onDelete={() =>
                    handleVolumeDataConfirmDelete(
                      "PseudoLabeledVolumeData",
                      selectedVolume?.pseudoVolumeArray[index].id
                    )
                  }
                  deleteQuestion={Utils.getFileNameFromPath(
                    selectedVolume?.pseudoVolumeArray[index].rawFilePath
                  )}
                  deleteTitle={"Remove Pseudo Volume Data?"}
                  preventChanges={!activeProject?.hasWriteAccess}
                  isActive={
                    !!selectedVolume?.volumeDataConfirmDeleteActiveRequest
                  }
                />
              ) : (
                <ItemTitleDownloadDelete inactive={true} />
              )}
            </div>
          ))}

          {/* Horizontal Line */}
          <hr
            style={{
              margin: "2px 0",
              border: "1px solid",
              borderColor: tokens.colorNeutralBackground1Hover,
            }}
          />

          <h3 className={globalClasses.subSectionTitle}>Results</h3>

          {/* Results List Dropdown */}
          <div className={globalClasses.drowdownActionsContainer}>
            <ComboboxSearch
              selectionList={resultSelectionList()}
              selectedOption={
                selectedResult
                  ? resultSelectionProperties(selectedResult)
                  : undefined
              }
              onOptionSelect={handleResultSelect}
              placeholder="Select a result"
              noOptionsMessage="No results match your search."
              className={globalClasses.selectionDropdown}
              disabled={
                !selectedVolume || isPageBusy() || !results || results.size < 1
              }
            />
            <Tooltip
              content="Refresh result data."
              relationship="label"
              hideDelay={0}
            >
              <Button
                className={globalClasses.sideActionButton}
                appearance="subtle"
                icon={
                  <ArrowSync24Regular
                    className={mergeClasses(
                      isLoadingResults && "spinning-icon"
                    )}
                  />
                }
                disabled={resultActionsDisabled()}
                onClick={() => refreshVolumeResultsData()}
              />
            </Tooltip>
          </div>

          <div className={globalClasses.actionButtonRow}>
            <Button
              appearance="secondary"
              className={mergeClasses(
                globalClasses.actionButton,
                classes.uploadDownloadButtom
              )}
              onClick={handleDownloadResultFiles}
              disabled={!selectedResultId}
            >
              <div className={globalClasses.actionButtonIconContainer}>
                <ArrowDownload20Regular />
              </div>
              <div className="buttonText">Download Files</div>
            </Button>
            <Tooltip
              content="Visualize Result"
              relationship="label"
              appearance="inverted"
              hideDelay={0}
            >
              <Button
                appearance="primary"
                className={mergeClasses(
                  globalClasses.actionButton,
                  classes.visualizeButton
                )}
                disabled={!selectedResultId}
                onClick={handleResultVisualisationRequest}
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <ProjectionScreen20Regular />
                </div>
                <div className="buttonText">Visualize</div>
              </Button>
            </Tooltip>
            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={"Remove Result from the Volume"}
                  hasWriteAccess={activeProject?.hasWriteAccess}
                />
              }
              relationship="label"
              appearance="inverted"
              hideDelay={0}
            >
              <Button
                className={mergeClasses(
                  globalClasses.actionButton,
                  selectedVolume && globalClasses.actionButtonDelete
                )}
                disabled={!selectedResultId || !activeProject?.hasWriteAccess}
                onClick={() => setDeleteResultDialogOpen(true)}
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <Delete20Regular />
                </div>
                <div className="buttonText">Remove</div>
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      <DeleteDialog
        TitleText={"Remove Volume?"}
        BodyText={
          "Do you want to remove the selected volume from the active project?"
        }
        open={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={confirmDeleteVolume}
        isActive={!!projectVolumes?.removeVolumeActiveRequest}
      />

      {/* Create Volume Dialog */}
      <CreateVolumeDialog
        open={isCreateDialogOpen}
        onClose={closeCreateDialog}
        onCreate={handleCreateVolume}
        isActive={!!projectVolumes?.createVolumeActiveRequest}
      />

      {/* Remove Result Dialog */}
      <DeleteDialog
        TitleText={"Remove Result?"}
        BodyText={
          "Do you want to remove the selected result from the current volume?"
        }
        open={isDeleteResultDialogOpen}
        onClose={handleCloseCheckpointDialog}
        onConfirm={removeResult}
        isActive={!!volumeResults?.removeResultActiveRequest}
      />
    </div>
  ) : null;
});

export default Volume;
