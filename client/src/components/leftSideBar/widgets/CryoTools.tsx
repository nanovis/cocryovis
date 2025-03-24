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
  TabList,
  TabValue,
  Tab,
  Input,
  Slider,
  Label
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

const CryoTools = observer(({ open, close }: Props) => {
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
  const [tab, setTab] = useState<string>("motion");
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDeleteResultDialogOpen, setDeleteResultDialogOpen] = useState(false);
  const [isLoadingResults, setLoadingResults] = useState(false);
  const [isLoadingVolumes, setLoadingVolumes] = useState(false);
  const [isUploadingData, setIsUploadingData] = useState(false);
  const [isTiltSeriesDialogOpen, setIsTiltSeriesDialogOpen] = useState(false);
  const [isUploadVolumeDialogOpen, setIsUploadVolumeDialogOpen] =
    useState(false);
  // MotionCor3 UI state
  const [patchX, setPatchX] = useState("5");
  const [patchY, setPatchY] = useState("5");
  const [binning, setBinning] = useState("2");
  const [doseWeighting, setDoseWeighting] = useState(true);

  const [totalDose, setTotalDose] = useState("120");
  const [tiltAxis, setTiltAxis] = useState("0");
  const [alignZ, setAlignZ] = useState("300");
  const [volZ, setVolZ] = useState("300");
  const [gainFile, setGainFile] = useState("");
  const [darkRef, setDarkRef] = useState("");
  const [defectFile, setDefectFile] = useState("");
  const [patchSize, setPatchSize] = useState("5");
  const [iterations, setIterations] = useState("5");
  const [tolerance, setTolerance] = useState("0.1");
  const [ampContrast, setAmpContrast] = useState("0.07");
  const [ctfCorrection, setCtfCorrection] = useState("PhaseFlip");
  const [defocusHandling, setDefocusHandling] = useState("default");



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

        if (!file.name.endsWith(".ali")) {
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


      const areTomoSettings = {
        totalDose,
        tiltAxis,
        alignZ,
        volZ,
        binningFactor: Number(binning),
        gainReferencePath: gainFile,
        darkReferencePath: darkRef,
        defectFile,
        patchSize: Number(patchSize),
        iterations: Number(iterations),
        tolerance: Number(tolerance),
        amplitudeContrast: Number(ampContrast),
        ctfCorrection,
        defocusHandling
      };
  

      const response = await Utils.sendReq(
        `preprocessing/AreTomo3/${dataType}/${id}/visualization-data`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(areTomoSettings),
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
    selectedVolume.setShownAnnotation(index, true);
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
          <h1>Pre Processing</h1>
          <div
            onClick={close}
            className={globalClasses.closeSidebarIconContainer}
          >
            <ArrowCircleLeft28Regular className={globalClasses.closeSidebarIcon} />
          </div>
        </div>
  
        <div className={globalClasses.siderbarBody}>
          <Text size={300} weight="semibold">AreTomo3 Settings</Text>
  
          {/* General Settings */}
          <Text weight="semibold">General Settings</Text>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Label htmlFor="totalDose">Total Dose</Label>
            <Input id="totalDose" type="number" value={totalDose} onChange={(e) => setTotalDose(e.target.value)} />
  
            <Label htmlFor="tiltAxis">Tilt Axis (degrees)</Label>
            <Input id="tiltAxis" type="number" value={tiltAxis} onChange={(e) => setTiltAxis(e.target.value)} />
  
            <Label htmlFor="alignZ">Alignment Thickness (Z)</Label>
            <Input id="alignZ" type="number" value={alignZ} onChange={(e) => setAlignZ(e.target.value)} />
  
            <Label htmlFor="volZ">Volume Thickness (Z)</Label>
            <Input id="volZ" type="number" value={volZ} onChange={(e) => setVolZ(e.target.value)} />
  
            <Label htmlFor="binning">Binning Factor</Label>
            <Slider
              id="binning"
              min={1}
              max={8}
              step={1}
              value={Number(binning)}
              onChange={(_, data) => setBinning(data.value.toString())}
            />
            <Text size={200}>Current: {binning}</Text>
          </div>
  
          {/* Motion Correction */}
          <Text weight="semibold" style={{ marginTop: "16px" }}>Motion Correction</Text>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Label htmlFor="gainFile">Gain Reference File</Label>
            <Input id="gainFile" type="text" value={gainFile} onChange={(e) => setGainFile(e.target.value)} />
  
            <Label htmlFor="darkRef">Dark Reference File</Label>
            <Input id="darkRef" type="text" value={darkRef} onChange={(e) => setDarkRef(e.target.value)} />
  
            <Label htmlFor="defectFile">Defect File</Label>
            <Input id="defectFile" type="text" value={defectFile} onChange={(e) => setDefectFile(e.target.value)} />
  
            <Label htmlFor="patchSize">Patch Size</Label>
            <Input id="patchSize" type="number" value={patchSize} onChange={(e) => setPatchSize(e.target.value)} />
  
            <Label htmlFor="iterations">Iterations</Label>
            <Input id="iterations" type="number" value={iterations} onChange={(e) => setIterations(e.target.value)} />
  
            <Label htmlFor="tolerance">Tolerance</Label>
            <Input
              id="tolerance"
              type="number"
              step="0.001"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
            />
          </div>
  
          {/* CTF Estimation */}
          <Text weight="semibold" style={{ marginTop: "16px" }}>CTF Estimation</Text>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Label htmlFor="ampContrast">Amplitude Contrast</Label>
            <Input
              id="ampContrast"
              type="number"
              step="0.01"
              value={ampContrast}
              onChange={(e) => setAmpContrast(e.target.value)}
            />
  
            <Label htmlFor="ctfCorrection">CTF Correction Method</Label>
            <Input
              id="ctfCorrection"
              type="text"
              placeholder="e.g., PhaseFlip"
              value={ctfCorrection}
              onChange={(e) => setCtfCorrection(e.target.value)}
            />
  
            <Label htmlFor="defocusHandling">Defocus Handling</Label>
            <Input
              id="defocusHandling"
              type="text"
              value={defocusHandling}
              onChange={(e) => setDefocusHandling(e.target.value)}
            />
          </div>
  
          {/* Visualize Button */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            <Tooltip
              content="Visualize Raw Data"
              relationship="label"
              appearance="inverted"
              hideDelay={0}
            >
              <Button
                appearance="primary"
                className={mergeClasses(globalClasses.actionButton, classes.visualizeButton)}
                disabled={!hasRawData() || isPageBusy()}
                onClick={() =>
                  handleVisualisationRequest("RawVolumeData", selectedVolume?.rawData?.id, selectedVolume)
                }
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <ProjectionScreen20Regular />
                </div>
                <div className="buttonText">Visualize</div>
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  ) : null;  
});

  export default CryoTools;