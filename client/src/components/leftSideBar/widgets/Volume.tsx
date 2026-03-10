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
  Edit24Regular,
  EditSettings24Regular,
  ErrorCircle16Filled,
  ProjectionScreen20Regular,
  ProjectionScreenText24Regular,
  Stack24Regular,
} from "@fluentui/react-icons";
import { useState, useRef } from "react";
import CreateVolumeDialog from "./elements/CreateVolumeDialog";
import ItemTitleDownloadDelete from "@/components/shared/ItemTitleDownloadDelete";
import * as Utils from "@/utils/helpers";
import DeleteDialog from "@/components/shared/DeleteDialog";
import { CONFIG } from "@/constants";
import globalStyles from "@/components/globalStyles";
import ComboboxSearch from "@/components/shared/ComboboxSearch";
import type { TiltSeriesOptions } from "@/components/shared/ProcessTiltSeriesDialog";
import ProcessTiltSeriesDialog from "@/components/shared/ProcessTiltSeriesDialog";
import { observer } from "mobx-react-lite";
import { useMst } from "@/stores/RootStore";
import type {
  LabeledVolumeTypes,
  VolumeInstance,
} from "@/stores/userState/VolumeModel";
import {
  WriteAccessTooltipContent,
  WriteAccessTooltipContentWrapper,
} from "@/components/shared/WriteAccessTooltip";
import {
  MrcFileVolumeData,
  MrcUrlVolumeData,
  RawFileVolumeData,
  RawUrlVolumeData,
  type TransferFunction,
  VolumeDescriptor,
} from "@/utils/volumeDescriptor";
import VolumeUploadDialog from "@/components/shared/VolumeUploadDialog";
import {
  SparseLabelVolume,
  type SparseVolumeInstance,
} from "@/stores/userState/SparseVolumeModel";
import type { PseudoVolumeInstance } from "@/stores/userState/PseudoVolumeModel";
import { queuePseudoLabelsGeneration } from "@/api/ilastik";
import { queueTiltSeriesReconstruction } from "@/api/cryoEt";
import {
  downloadFullVolumeData,
  getVolumeVisualizationFiles,
} from "@/api/volumeData";
import { getResultData } from "@/api/results";
import ToastContainer from "@/utils/toastContainer";
import VolumeEditDialog from "./elements/VolumeEditDialog";
import {
  fileMapToVisualizationConfig,
  visualizeVolumeFromConfig,
} from "@/utils/volumeVisualization";
import type { VisualizationDescriptor } from "@/renderer/volume/volumeManager";
import { getType } from "mobx-state-tree";
import {
  resultRenderOption,
  resultTooltip,
  volumeRenderOption,
  volumeTooltip,
} from "@/components/shared/ComboboxOptions";
import type z from "zod";
import type { volumeUpdateSchema } from "@cocryovis/schemas/componentSchemas/volume-schema";

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
  titleRow: {
    display: "flex",
  },
  buttonRow: {
    display: "flex",
    gap: "15px",
  },
  button: {
    height: "20px",
    minWidth: "50px",
  },
  actionButton: {
    width: "32px",
    height: "32px",
    minWidth: "32px",
    "&.fui-Button__icon": {
      color: tokens.colorBrandForeground1,
    },
    ":disabled &.fui-Button__icon": {
      opacity: 0.5,
      pointerEvents: "none",
    },
  },
});

type RawDataTypes = "RawVolumeData" | LabeledVolumeTypes;

interface Props {
  open: boolean;
  close: () => void;
}

const Volume = observer(({ open, close }: Props) => {
  const { user, uiState, renderer } = useMst();

  const activeProject = user.userProjects.activeProject;
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteResultDialogOpen, setIsDeleteResultDialogOpen] =
    useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isLoadingVolumes, setIsLoadingVolumes] = useState(false);
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

  const editVolumeDialogOpen = () => {
    setIsEditDialogOpen(true);
  };

  const editVolumeDialogClose = () => {
    setIsEditDialogOpen(false);
  };

  const createVolume = () => {
    setIsCreateDialogOpen(true);
  };

  const openDeleteDialog = () => {
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
  };

  const handleCloseCheckpointDialog = () => {
    setIsDeleteResultDialogOpen(false);
  };

  const handleEditDialog = async (data: z.infer<typeof volumeUpdateSchema>) => {
    if (!selectedVolume) {
      return;
    }
    const toastContainer = new ToastContainer();
    try {
      toastContainer.loading("Updating volume...");
      await selectedVolume.updateVolume(data);
      editVolumeDialogClose();
      toastContainer.success("Updated volume!");
    } catch (error) {
      console.error(error);
      toastContainer.error(Utils.getErrorMessage(error));
    }
  };

  const handleVolumeSelect = (value: string | null) => {
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

  const handleRenameSparseData = async (
    volumeData: SparseVolumeInstance,
    newName: string
  ) => {
    const toastContainer = new ToastContainer();
    try {
      toastContainer.loading("Changing name...");

      await volumeData.updateName(newName);
      toastContainer.success("Label name changed!");
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(Utils.getErrorMessage(error));
    }
  };

  const handleRenamePseudoData = async (
    volumeData: PseudoVolumeInstance,
    newName: string
  ) => {
    const toastContainer = new ToastContainer();
    try {
      toastContainer.loading("Changing name...");

      await volumeData.updateName(newName);
      toastContainer.success("Label name changed!");
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(Utils.getErrorMessage(error));
    }
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
      toastContainer.success("Volume created!");
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(Utils.getErrorMessage(error));
    }
    projectVolumes.setCreateVolumeActiveRequest(false);
  };

  const uploadRawData = async (volumeDescriptor: VolumeDescriptor) => {
    const toastContainer = new ToastContainer();
    try {
      toastContainer.loading("Uploading files...");

      if (!selectedVolume) {
        throw new Error("No volume selected.");
      }

      const volumeData = volumeDescriptor.volumeData;
      if (volumeData instanceof MrcUrlVolumeData) {
        await selectedVolume.uploadFromUrl(volumeData.url, "mrc");
      } else if (volumeData instanceof RawUrlVolumeData) {
        const settings = await volumeDescriptor.getSettings();
        await selectedVolume.uploadFromUrl(volumeData.url, "raw", settings);
      } else if (volumeData instanceof MrcFileVolumeData) {
        await selectedVolume.uploadMrcVolume(volumeData.file);
      } else if (volumeData instanceof RawFileVolumeData) {
        const settings = await volumeDescriptor.getSettings();
        await selectedVolume.uploadRawVolume(volumeData.file, {
          ...settings,
          file: volumeData.file.name,
        });
      } else {
        throw new Error("Invalid volume data.");
      }

      toastContainer.success("Data uploaded!");
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
        await queueTiltSeriesReconstruction(formData);
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

      let transferFunction: TransferFunction | undefined;
      if (getType(volumeInstance) === SparseLabelVolume) {
        const sparseLabelVolume = volumeInstance as SparseVolumeInstance;
        if (sparseLabelVolume.color) {
          const color = Utils.fromHexColor(sparseLabelVolume.color);
          transferFunction = {
            rampLow: 0,
            rampHigh: 1,
            color: {
              x: color.r,
              y: color.g,
              z: color.b,
            },
          };
        }
      }
      const volumeDescriptor = await VolumeDescriptor.fromFileMap(
        fileMap,
        transferFunction
      );

      await uiState.visualizeVolume(
        { descriptors: [volumeDescriptor] },
        volumeInstance
      );

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

      if (!renderer) {
        throw new Error("Renderer not initialized.");
      }

      toastContainer.loading(
        `Fetching manual label volume 0/${volume.sparseVolumeArray.length}`
      );

      let volumeArray;
      if (dataType === "SparseLabeledVolumeData") {
        volumeArray = volume.sparseVolumeArray;
      }
      if (dataType === "PseudoLabeledVolumeData") {
        volumeArray = volume.pseudoVolumeArray;
      }

      if (!volumeArray || volumeArray.length === 0) {
        throw new Error("No manual label volumes found.");
      }

      const type = dataType === "SparseLabeledVolumeData" ? "Manual" : "Pseudo";

      const visualizationDescriptor: VisualizationDescriptor = {
        descriptors: [],
      };

      for (let i = 0; i < volumeArray.length; i++) {
        const labelVolume = volumeArray[i];
        toastContainer.loading(
          `Fetching ${type} label volume ${i + 1}/${volumeArray.length}`
        );

        await Utils.waitForNextFrame();

        const color =
          "color" in labelVolume && labelVolume.color
            ? Utils.fromHexColor(labelVolume.color as string)
            : { r: 255, g: 255, b: 255 };

        const transferFunction: TransferFunction = {
          rampLow: 0,
          rampHigh: 1,
          color: {
            x: color.r,
            y: color.g,
            z: color.b,
          },
        };

        const contents = await downloadFullVolumeData(dataType, labelVolume.id);
        const fileMap = await Utils.zipToFileMap(contents);
        const volumeDescriptor = await VolumeDescriptor.fromFileMap(
          fileMap,
          transferFunction
        );
        visualizationDescriptor.descriptors.push(volumeDescriptor);
      }

      toastContainer.loading("Processing rendering data...");

      const visualizedVolume = await visualizeVolumeFromConfig(
        renderer,
        visualizationDescriptor,
        volumeArray
      );

      uiState.setVizualizedVolume(visualizedVolume);

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

      const visualizationDescriptor =
        await fileMapToVisualizationConfig(fileMap);

      await uiState.visualizeVolume(visualizationDescriptor, selectedResult);

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
      setIsLoadingVolumes(true);
      await projectVolumes?.refreshVolumes();
    } catch (error) {
      console.error("Error:", error);
      const toastContainer = new ToastContainer();
      toastContainer.error(Utils.getErrorMessage(error));
    } finally {
      setIsLoadingVolumes(false);
    }
  };

  const handleSparseLabelFileChange = async (event: FileChangeEvent) => {
    const toastContainer = new ToastContainer();
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
        await visualizedVolume?.setLabelEditingMode(false);
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

  const handleAnnotationEdit = (index: number) => {
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
      setIsDeleteResultDialogOpen(false);
      toastContainer.success("Result deleted!");
    } catch (error) {
      console.error("Error", error);
      toastContainer.error(Utils.getErrorMessage(error));
    }
    volumeResults.setRemoveResultActiveRequest(false);
  };

  const refreshVolumeResultsData = async () => {
    try {
      setIsLoadingResults(true);
      await volumeResults?.refreshResults();
    } catch (error) {
      console.error(error);
      const toastContainer = new ToastContainer();
      toastContainer.error(Utils.getErrorMessage(error));
    } finally {
      setIsLoadingResults(false);
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
          <div className={classes.buttonRow}>
            <h2>Volume</h2>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Tooltip
                content={
                  <WriteAccessTooltipContentWrapper
                    content={"Edit name and description"}
                    hasWriteAccess={activeProject?.hasWriteAccess}
                  />
                }
                relationship="label"
                hideDelay={0}
                appearance="inverted"
              >
                <Button
                  appearance="secondary"
                  icon={
                    <Edit24Regular
                      className={mergeClasses(
                        globalClasses.successIcon,
                        !selectedVolumeId && globalClasses.disabledIcon
                      )}
                    />
                  }
                  onClick={editVolumeDialogOpen}
                  disabled={!selectedVolumeId || !activeProject?.hasWriteAccess}
                />
              </Tooltip>
            </div>
          </div>
          {/* Dropdown for selecting project volumes */}
          <div className={globalClasses.drowdownActionsContainer}>
            <ComboboxSearch
              selectionList={projectVolumes?.volumeComboboxOptions ?? []}
              selectedOption={selectedVolume?.comboboxOption}
              onOptionSelect={handleVolumeSelect}
              renderOption={volumeRenderOption}
              renderTooltipContent={volumeTooltip}
              placeholder="Select a volume"
              noOptionsMessage="No volumes match your search."
              className={globalClasses.selectionDropdown}
              disabled={
                isPageBusy() ||
                !projectVolumes ||
                projectVolumes.volumes.size === 0
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
                onClick={() => void refreshVolumes()}
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
                  void handleDownloadVolumeData(
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
                  void handleVisualisationRequest(
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
            onConfirm={uploadRawData}
            titleText={"Upload Raw Data"}
            confirmText="Upload"
            uploadDialogStore={uiState.uploadDialog}
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
                  void visualizeLabelVolumes(
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
                    void visualizedVolume.setLabelEditingMode(data.checked);
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
                  selectedVolume.sparseVolumes.size >= 4 ||
                  !activeProject?.hasWriteAccess
                }
                onClick={() => sparseLabelFileRef.current?.click()}
              />
            </Tooltip>
          </div>

          <input
            type="file"
            onChange={(e) => void handleSparseLabelFileChange(e)}
            accept=".raw, .json, .zip"
            multiple
            ref={sparseLabelFileRef}
            className={globalClasses.hiddenInput}
          />

          {Array.from({ length: CONFIG.maxLabels }, (_v, index) => (
            <div key={index}>
              {selectedVolume &&
              index < selectedVolume.sparseVolumeArray.length ? (
                <ItemTitleDownloadDelete
                  title={selectedVolume.sparseVolumeArray[index].name}
                  highlighted={
                    visualizedVolume?.labelEditingMode &&
                    visualizedVolume.manualLabelIndex === index
                  }
                  onDownload={() =>
                    void handleDownloadVolumeData(
                      "SparseLabeledVolumeData",
                      selectedVolume.sparseVolumeArray[index].id
                    )
                  }
                  onVisualize={() =>
                    void handleVisualisationRequest(
                      "SparseLabeledVolumeData",
                      selectedVolume.sparseVolumeArray[index].id,
                      selectedVolume.sparseVolumeArray[index]
                    )
                  }
                  onDelete={async () =>
                    handleVolumeDataConfirmDelete(
                      "SparseLabeledVolumeData",
                      selectedVolume.sparseVolumeArray[index].id
                    )
                  }
                  onEdit={() => handleAnnotationEdit(index)}
                  canEdit={canEditAnnotations}
                  canChangeColor={canEditAnnotations}
                  deleteQuestion={selectedVolume.sparseVolumeArray[index].name}
                  deleteTitle={"Remove Sparse Volume Data?"}
                  preventChanges={!activeProject?.hasWriteAccess}
                  color={
                    selectedVolume.sparseVolumeArray[index].color ?? undefined
                  }
                  onColorChange={(color) => {
                    void selectedVolume.sparseVolumeArray[index].setColor(
                      color,
                      index
                    );
                  }}
                  isEnabled={selectedVolume.shownAnnotations[index]}
                  onEnabled={() => {
                    selectedVolume.toggleShownAnnotation(index);
                  }}
                  isActive={selectedVolume.volumeDataConfirmDeleteActiveRequest}
                  onEditVolumeData={async (newTitle) => {
                    await handleRenameSparseData(
                      selectedVolume.sparseVolumeArray[index],
                      newTitle
                    );
                  }}
                  isEditVolumeData={
                    selectedVolume.sparseVolumeArray[index] ===
                    selectedVolume.editingSparseVolumeData
                  }
                  onStartEditVolumeData={() =>
                    selectedVolume.setEditingSparseVolumeData(
                      selectedVolume.sparseVolumeArray[index]
                    )
                  }
                  onStopEditVolumeData={() =>
                    selectedVolume.setEditingSparseVolumeData(undefined)
                  }
                />
              ) : (
                <ItemTitleDownloadDelete
                  inactive={true}
                  highlighted={
                    visualizedVolume?.labelEditingMode &&
                    visualizedVolume.manualLabelIndex === index
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
                      selectedVolume.sparseVolumeArray.length < 2 ? (
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
                  selectedVolume.sparseVolumeArray.length < 2 ||
                  selectedVolume.sparseVolumeArray.length +
                    selectedVolume.pseudoVolumeArray.length >
                    4 ||
                  !activeProject?.hasWriteAccess
                }
                onClick={() => void queuePseudoLabelGeneration()}
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
                  void visualizeLabelVolumes(
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
                  selectedVolume.pseudoVolumeArray.length >= 4 ||
                  !activeProject?.hasWriteAccess
                }
                onClick={() => pseudoLabelFileRef.current?.click()}
              />
            </Tooltip>
          </div>

          <input
            type="file"
            onChange={(e) => void handlePseudoLabelFileChange(e)}
            accept=".raw, .json, .zip"
            multiple
            ref={pseudoLabelFileRef}
            className={globalClasses.hiddenInput}
          />

          {Array.from({ length: CONFIG.maxLabels }, (_v, index) => (
            <div key={index}>
              {selectedVolume &&
              index < selectedVolume.pseudoVolumeArray.length ? (
                <ItemTitleDownloadDelete
                  title={selectedVolume.pseudoVolumeArray[index].name}
                  onDownload={() =>
                    void handleDownloadVolumeData(
                      "PseudoLabeledVolumeData",
                      selectedVolume.pseudoVolumeArray[index].id
                    )
                  }
                  onVisualize={() =>
                    void handleVisualisationRequest(
                      "PseudoLabeledVolumeData",
                      selectedVolume.pseudoVolumeArray[index].id,
                      selectedVolume.pseudoVolumeArray[index]
                    )
                  }
                  onDelete={async () =>
                    handleVolumeDataConfirmDelete(
                      "PseudoLabeledVolumeData",
                      selectedVolume.pseudoVolumeArray[index].id
                    )
                  }
                  deleteQuestion={selectedVolume.pseudoVolumeArray[index].name}
                  deleteTitle={"Remove Pseudo Volume Data?"}
                  preventChanges={!activeProject?.hasWriteAccess}
                  isActive={selectedVolume.volumeDataConfirmDeleteActiveRequest}
                  onEditVolumeData={async (newTitle) => {
                    await handleRenamePseudoData(
                      selectedVolume.pseudoVolumeArray[index],
                      newTitle
                    );
                  }}
                  isEditVolumeData={
                    selectedVolume.pseudoVolumeArray[index] ===
                    selectedVolume.editingPseudoVolumeData
                  }
                  onStartEditVolumeData={() =>
                    selectedVolume.setEditingPseudoVolumeData(
                      selectedVolume.pseudoVolumeArray[index]
                    )
                  }
                  onStopEditVolumeData={() =>
                    selectedVolume.setEditingPseudoVolumeData(undefined)
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
              selectionList={volumeResults?.resultComboboxOptions ?? []}
              selectedOption={selectedResult?.comboboxOption}
              onOptionSelect={handleResultSelect}
              renderOption={resultRenderOption}
              renderTooltipContent={resultTooltip}
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
                onClick={() => void refreshVolumeResultsData()}
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
              onClick={() => void handleDownloadResultFiles()}
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
                onClick={() => void handleResultVisualisationRequest()}
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
                onClick={() => setIsDeleteResultDialogOpen(true)}
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
        onConfirm={() => void confirmDeleteVolume()}
        isActive={!!projectVolumes?.removeVolumeActiveRequest}
      />

      <VolumeEditDialog
        open={isEditDialogOpen}
        title="Edit Volume"
        onClose={editVolumeDialogClose}
        onEdit={handleEditDialog}
        isActive={!!selectedVolume?.updateVolumeActiveRequest}
        defaultName={selectedVolume?.name ?? ""}
        defaultDescription={selectedVolume?.description ?? ""}
      />

      <CreateVolumeDialog
        open={isCreateDialogOpen}
        onClose={closeCreateDialog}
        onCreate={handleCreateVolume}
        isActive={!!projectVolumes?.createVolumeActiveRequest}
      />

      <DeleteDialog
        TitleText={"Remove Result?"}
        BodyText={
          "Do you want to remove the selected result from the current volume?"
        }
        open={isDeleteResultDialogOpen}
        onClose={handleCloseCheckpointDialog}
        onConfirm={() => void removeResult()}
        isActive={!!volumeResults?.removeResultActiveRequest}
      />
    </div>
  ) : null;
});

export default Volume;
