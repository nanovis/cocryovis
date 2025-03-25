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
import DeleteVolumeDialog from "./elements/DeleteVolumeDialog";
import CreateVolumeDialog from "./elements/CreateVolumeDialog";
import ItemTitleDownloadDelete from "../../shared/ItemTitleDownloadDelete";
import Utils from "../../../functions/Utils";
import { toast } from "react-toastify";
import DeleteDialog from "../../shared/DeleteDialog";
import { CONFIG } from "../../../Constants";
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
import { VolumeSettings } from "../../../functions/VolumeSettings";
import VolumeUploadDialog from "../../shared/VolumeUploadDialog";
import { SparseVolumeInstance } from "../../../stores/userState/SparseVolumeModel";
import { PseudoVolumeInstance } from "../../../stores/userState/PseudoVolumeModel";
import { VolVisSettingsSnapshotIn } from "../../../stores/uiState/VolVisSettings";
import { VisualizedVolumeSnapshotIn } from "../../../stores/uiState/VisualizedVolume";
import { DEFAULT_TF } from "../../../DefaultTransferFunctions";

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
    try {
      if (!selectedVolumeId) {
        return;
      }
      await projectVolumes?.removeVolume(selectedVolumeId);
      closeDeleteDialog();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleCreateVolume = async (name: string, description: string) => {
    try {
      await projectVolumes?.createVolume(name, description);

      closeCreateDialog();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const uploadRawData = async (
    pendingFile: File,
    volumeSettings?: VolumeSettings
  ) => {
    let toastId = null;
    try {
      toastId = toast.loading("Uploading files...");
      if (Utils.isMrcFile(pendingFile.name)) {
        try {
          await selectedVolume?.uploadMrcVolume(pendingFile);
        } catch (error) {
          if (error instanceof Error) {
            throw new Error("Error converting MRC file:" + error.message);
          } else {
            throw new Error("Error converting MRC file");
          }
        }
      } else {
        if (!Utils.isRawFile(pendingFile.name)) {
          throw new Error("No .raw file found in the uploaded files");
        }

        if (!volumeSettings) {
          throw new Error("Missing volume settings");
        }

        volumeSettings.file = pendingFile.name;
        volumeSettings.checkValidity();

        const volumeSettingsFile = volumeSettings.toFile();
        await Utils.waitForNextFrame();
        await selectedVolume?.uploadRawVolume(pendingFile, volumeSettingsFile);
      }

      toast.update(toastId, {
        render: "Data successfully uploaded!",
        type: "success",
        isLoading: false,
        autoClose: 2000,
        closeOnClick: true,
      });
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Error:", error);
    }
  };

  const uploadUrl = async (
    url: string,
    fileType: string,
    volumeSettings?: VolumeSettings
  ) => {
    let toastId = null;
    try {
      toastId = toast.loading("Uploading files...");
      await selectedVolume?.uploadFromUrl(url, fileType, volumeSettings);
      toast.update(toastId, {
        render: "Data successfully uploaded!",
        type: "success",
        isLoading: false,
        autoClose: 2000,
        closeOnClick: true,
      });
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Error:", error);
    }
  };

  const tiltSeriesUpload = async (
    file: File,
    options: TiltSeriesOptions,
    serverSide?: boolean
  ) => {
    let toastId = null;
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
        await Utils.sendRequestWithToast(
          `tilt-series-reconstruction`,
          {
            method: "POST",
            body: formData,
          },
          { successText: "Tilt series reconstruction successfuly queued!" }
        );
      } else {
        toastId = toast.loading("Processing data...");
        const { parsedSettings, fileData } =
          await Utils.convertTiltSeriesToRawData(file, options.volume_depth);

        toast.update(toastId, {
          render: "Uploading data to the server...",
          isLoading: true,
          autoClose: false,
        });

        await selectedVolume?.uploadTiltSeries(parsedSettings, fileData);

        toast.update(toastId, {
          render: "Data successfully uploaded!",
          type: "success",
          isLoading: false,
          autoClose: 2000,
          closeOnClick: true,
        });
      }
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Error:", error);
      throw error;
    } finally {
      setIsUploadingData(false);
    }
  };

  const handleVisualisationRequest = async (
    dataType: RawDataTypes,
    id: Number | undefined,
    volumeInstance:
      | VolumeInstance
      | SparseVolumeInstance
      | PseudoVolumeInstance
      | undefined
  ) => {
    if (!volumeInstance || !id) {
      return;
    }

    let toastId = null;

    try {
      toastId = toast.loading("Fetching visualization data...");

      const response = await Utils.sendReq(
        `volumeData/${dataType}/${id}/visualization-data`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      toast.update(toastId, {
        render: "Processing visualization data...",
        isLoading: true,
        autoClose: false,
      });

      const contents = await response.blob();
      const fileMap = await Utils.zipToFileMap(contents);

      await uiState.visualizeVolume(fileMap, volumeInstance);

      toast.dismiss(toastId);
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Error:", error);
    }
  };

  const visualizeLabelVolumes = async (
    volume: VolumeInstance | undefined,
    dataType: "SparseLabeledVolumeData" | "PseudoLabeledVolumeData"
  ) => {
    let toastId = null;

    try {
      if (!volume) {
        throw new Error("No volume selected.");
      }

      toastId = toast.loading(
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
        toast.update(toastId, {
          render: `Fetching ${type} label volume ${i + 1}/${
            volumeArray.length
          }`,
          isLoading: true,
          autoClose: false,
        });
        await Utils.waitForNextFrame();

        const response = await Utils.sendReq(
          `volumeData/${dataType}/${labelVolume.id}/download-full`,
          {
            method: "GET",
          },
          false
        );

        const contents = await response.blob();
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
          color = Utils.fromHexColor(labelVolume.color as string);
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

      toast.update(toastId, {
        render: "Processing rendering data...",
        isLoading: true,
        autoClose: false,
      });
      await Utils.waitForNextFrame();

      window.WasmModule?.FS.writeFile("config.json", JSON.stringify(config));
      window.WasmModule?.open_volume();
      uiState.setVizualizedVolume(vizualizedVolume);

      toast.update(toastId, {
        render: `${type} label volumes visualized.`,
        type: "success",
        isLoading: false,
        autoClose: 2000,
        closeOnClick: true,
      });
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Error:", error);
    }
  };

  // dataType options = 'RawVolumeData', 'SparseLabeledVolumeData', 'PseudoLabeledVolumeData'.
  const handleResultVisualisationRequest = async () => {
    let toastId = null;

    try {
      toastId = toast.loading("Fetching visualization data...");

      const response = await Utils.sendReq(`result/${selectedResultId}/data`, {
        method: "GET",
        credentials: "include",
      });

      toast.update(toastId, {
        render: "Processing visualization data...",
        isLoading: true,
        autoClose: false,
      });

      const contents = await response.blob();
      const fileMap = await Utils.zipToFileMap(contents);

      await uiState.visualizeVolume(fileMap, selectedResult);

      toast.dismiss(toastId);
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Error:", error);
    }
  };

  const queuePseudoLabelGeneration = async () => {
    if (!selectedVolumeId) {
      return;
    }
    try {
      await Utils.sendRequestWithToast(
        `volume/${selectedVolumeId}/queue-pseudo-label-generation`,
        {
          method: "POST",
          credentials: "include",
        },
        { successText: "Label generation successfuly queued!" }
      );
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const refreshVolumes = async () => {
    try {
      setLoadingVolumes(true);
      await projectVolumes?.refreshVolumes();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoadingVolumes(false);
    }
  };

  const handleSparseLabelFileChange = async (event: FileChangeEvent) => {
    try {
      if (!event.target.files) {
        return;
      }

      setIsUploadingData(true);
      await selectedVolume?.uploadSparseLabelVolume(event.target.files);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsUploadingData(false);
      if (sparseLabelFileRef.current) {
        sparseLabelFileRef.current.value = "";
      }
    }
  };

  const handlePseudoLabelFileChange = async (event: FileChangeEvent) => {
    try {
      if (!event.target.files) {
        return;
      }

      setIsUploadingData(true);
      await selectedVolume?.uploadPseudoLabelVolume(event.target.files);
    } catch (error) {
      console.error("Error:", error);
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
    try {
      if (!dataId) {
        return;
      }
      await selectedVolume?.deleteLabeledVolume(dataType, dataId);
      if (dataType === "SparseLabeledVolumeData") {
        visualizedVolume?.setLabelEditingMode(false);
      }
    } catch (error) {
      console.error("Error:", error);
    }
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
    }
  };

  const removeResult = async () => {
    try {
      if (!selectedResultId) {
        return;
      }

      await volumeResults?.removeResult(selectedResultId);
      setDeleteResultDialogOpen(false);
    } catch (error) {
      console.error("Error", error);
    }
  };

  const refreshVolumeResultsData = async () => {
    try {
      setLoadingResults(true);
      await volumeResults?.refreshResults();
    } catch (error) {
      console.error(error);
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
    return (
      activeProject?.hasWriteAccess &&
      selectedVolume &&
      visualizedVolume &&
      visualizedVolume.canEditLabels
    );
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

          {Array.from({ length: CONFIG.maxLabels }, (v, index) => (
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
                  color={selectedVolume.sparseVolumeArray[index].color}
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

          {Array.from({ length: CONFIG.maxLabels }, (v, index) => (
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

      {/* Delete Confirmation Dialog */}
      <DeleteVolumeDialog
        open={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={confirmDeleteVolume}
      />

      {/* Create Volume Dialog */}
      <CreateVolumeDialog
        open={isCreateDialogOpen}
        onClose={closeCreateDialog}
        onCreate={handleCreateVolume}
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
      />
    </div>
  ) : null;
});

export default Volume;
