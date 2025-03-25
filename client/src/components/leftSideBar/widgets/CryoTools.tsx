import {
  makeStyles,
  Button,
  Tooltip,
  mergeClasses,
  Input,
  Slider,
  Label
} from "@fluentui/react-components";
import {
  ArrowCircleLeft28Regular,
  ProjectionScreen20Regular,
} from "@fluentui/react-icons";
import { useState, useRef } from "react";
import Utils from "../../../functions/Utils";
import { toast } from "react-toastify";
import "../../../App.css";
import globalStyles from "../../GlobalStyles";
import ProcessTiltSeriesDialog, {
  TiltSeriesOptions,
} from "../../shared/ProcessTiltSeriesDialog";
import { observer } from "mobx-react-lite";
import { useMst } from "../../../stores/RootStore";
import {
  LabeledVolumeTypes,
  VolumeInstance,
} from "../../../stores/userState/VolumeModel";

import { ResultInstance } from "../../../stores/userState/ResultModel";
import { VolumeSettings } from "../../../functions/VolumeSettings";
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
  const visualizedVolume = uiState.visualizedVolume;

  const classes = useStyles();
  const globalClasses = globalStyles();

  const [isLoadingResults, setLoadingResults] = useState(false);
  const [isLoadingVolumes, setLoadingVolumes] = useState(false);
  const [isUploadingData, setIsUploadingData] = useState(false);
  const [isTiltSeriesDialogOpen, setIsTiltSeriesDialogOpen] = useState(false);
  const [isUploadVolumeDialogOpen, setIsUploadVolumeDialogOpen] =
    useState(false);
  // MotionCor3 UI state
  const [patchSize, setPatchSize] = useState("5");
  const [iterations, setIterations] = useState("5");
  const [tolerance, setTolerance] = useState("0.1");
  const [ampContrast, setAmpContrast] = useState("0.07");
  const [ctfCorrection, setCtfCorrection] = useState("PhaseFlip");
  const [defocusHandling, setDefocusHandling] = useState("default");
  const [pixSize, setPixelSize] = useState("1.19");
  const [dosePFrame, setDosePFrame] = useState("1.5");
  const [kv, setKv] = useState("300");
  const [sphericalAberration, setSphericalAberration] = useState("0.7");
  const [tileSize, setTileSize] = useState("512");

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
        kv: Number(kv),
        sphericalAberration,
        ampContrast: Number(ampContrast),
        tileSize: Number(tileSize),
        patchSize: Number(patchSize),
        iterations: Number(iterations),
        tolerance: Number(tolerance),
        amplitudeContrast: Number(ampContrast),
        ctfCorrection,
        defocusHandling,
      };
  
      const response = await Utils.sendReq(
        `preprocessing/${dataType}/${id}/visualization-data`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(areTomoSettings),
        }
      );
  
      // Handle the response as a blob (ZIP file)
      const blob = await response.blob();
  
      // Optionally extract a filename from the Content-Disposition header
      let filename = "visualization_data.zip";
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const filenameMatch = disposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
  
      // Create a temporary link to trigger the download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
  
      toast.update(toastId, {
        render: "Visualization data downloaded!",
        type: "success",
        isLoading: false,
        autoClose: 10000,
      });
      toast.dismiss(toastId);
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Error:", error);
    }
  };
  

  const handleMotionRequest = async (
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
      toastId = toast.loading("Applying motion correctness...");
  
      const areTomoSettings = {
        kv: Number(kv),
        sphericalAberration,
        ampContrast: Number(ampContrast),
        tileSize: Number(tileSize),
        patchSize: Number(patchSize),
        iterations: Number(iterations),
        tolerance: Number(tolerance),
        amplitudeContrast: Number(ampContrast),
        ctfCorrection,
        defocusHandling,
      };
  
      const response = await Utils.sendReq(
        `preprocessing/${dataType}/${id}/motion-correctness`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(areTomoSettings),
        }
      );
  
      // Instead of parsing JSON, handle the response as a blob
      const blob = await response.blob();
  
      // Optionally, get the filename from the Content-Disposition header
      let filename = "motion_corrected.zip";
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const filenameMatch = disposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
  
      // Create a temporary link element to trigger the download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
  
      toast.update(toastId, {
        render: "Motion correction completed and file downloaded!",
        type: "success",
        isLoading: false,
        autoClose: 10000,
      });
      toast.dismiss(toastId);
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
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

  const hasRawData = () => {
    return selectedVolume?.rawData;
  };

  const canUploadRawData = () => {
    return selectedVolume && !hasRawData();
  };

  const isVolumeSelected = () => {
    return selectedVolume;
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

          {/* Motion Correction */}
          <h2>Motion Correction</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

            <Label htmlFor="patchSize">Patch Size: [{Number(patchSize)}] x [{Number(patchSize)}]</Label>
            <Slider
              id="patchSize"
              min={1}
              max={10}
              step={1}
              value={Number(patchSize)}
              onChange={(_, data) => setPatchSize(data.value.toString())}
            />

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

            <Label htmlFor="pixSize">Pixel Size</Label>
            <Input id="pixSize" type="number" value={pixSize} onChange={(e) => setPixelSize(e.target.value)} />

            <Label htmlFor="kV">kiloVatios (kV)</Label>
            <Input id="kV" type="number" value={kv} onChange={(e) => setKv(e.target.value)} />

            {/* Visualize Button */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
              <Tooltip
                content="Visualize Data"
                relationship="label"
                appearance="inverted"
                hideDelay={0}
              >
                <Button
                  appearance="primary"
                  className={mergeClasses(globalClasses.actionButton, classes.visualizeButton)}
                  disabled={!hasRawData() || isPageBusy()}
                  onClick={() =>
                    handleMotionRequest("RawVolumeData", selectedVolume?.rawData?.id, selectedVolume)
                  }
                >
                  <div className={globalClasses.actionButtonIconContainer}>
                    <ProjectionScreen20Regular />
                  </div>
                  <div className="buttonText">Apply</div>
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* CTF Estimation */}
          <h2>CTF Estimation</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Label htmlFor="kV">kiloVatios (kv)</Label>
            <Input
              id="kV"
              type="number"
              step="0.01"
              value={kv}
              onChange={(e) => setAmpContrast(e.target.value)}
            />

            <Label htmlFor="sphericalAberration">Spherical Aberration</Label>
            <Input
              id="sphericalAberration"
              type="text"
              placeholder="e.g., PhaseFlip"
              value={sphericalAberration}
              onChange={(e) => setSphericalAberration(e.target.value)}
            />

            <Label htmlFor="ampContrast">Amp Contrast</Label>
            <Input
              id="ampContrast"
              type="text"
              value={ampContrast}
              onChange={(e) => setAmpContrast(e.target.value)}
            />

            <Label htmlFor="tileSize">Tile Size</Label>
            <Input
              id="tileSize"
              type="text"
              value={tileSize}
              onChange={(e) => setTileSize(e.target.value)}
            />
          </div>

          {/* Visualize Button */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            <Tooltip
              content="Visualize Data"
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
                <div className="buttonText">Apply</div>
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  ) : null;
});

export default CryoTools;