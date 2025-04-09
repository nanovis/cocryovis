import {
  makeStyles,
  Button,
  Tooltip,
  mergeClasses,
  Input,
  Slider,
  Label,
} from "@fluentui/react-components";
import {
  ArrowCircleLeft28Regular,
  ProjectionScreen20Regular,
} from "@fluentui/react-icons";
import { useState } from "react";
import Utils from "../../../functions/Utils";
import { toast } from "react-toastify";
import "../../../App.css";
import globalStyles from "../../GlobalStyles";
import { observer } from "mobx-react-lite";
import { useMst } from "../../../stores/RootStore";

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

interface Props {
  open: boolean;
  close: () => void;
}

const CryoTools = observer(({ open, close }: Props) => {
  const { user, uiState } = useMst();

  const selectedVolume =
    user?.userProjects.activeProject?.projectVolumes?.selectedVolume;

  const classes = useStyles();
  const globalClasses = globalStyles();

  // MotionCor3 UI state
  const [patchSize, setPatchSize] = useState("5");
  const [iterations, setIterations] = useState("5");
  const [tolerance, setTolerance] = useState("0.1");
  const [ampContrast, setAmpContrast] = useState("0.07");
  const [ctfCorrection, setCtfCorrection] = useState("PhaseFlip");
  const [defocusHandling, setDefocusHandling] = useState("default");
  const [pixSize, setPixelSize] = useState("1.19");
  const [kv, setKv] = useState("300");
  const [sphericalAberration, setSphericalAberration] = useState("0.7");
  const [tileSize, setTileSize] = useState("512");

  //Tilt series alignment tool
  const [peak, setPeak] = useState("5.0");
  const [diff, setDiff] = useState("2.0");
  const [grow, setGrow] = useState("5.0");
  const [iterationsTSA, setIterationsTSA] = useState("5");
  const [patchSizeTSA, setPatchSizeTSA] = useState("4");
  const [patchRadius, setPatchRadius] = useState("0.125");
  const [pixSizeTSA, setPixelSizeTSA] = useState("1.19");
  const [patchPixSize, setPatchPixSize] = useState("680");

  const isPageBusy = () => {
    return uiState.uploadDialog.isBusy;
  };

  const handleVisualisationRequest = async (id: Number | undefined) => {
    if (!id) {
      return;
    }

    let toastId = null;

    try {
      toastId = toast.loading("Applying CTF Estimation...");

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
        `preprocessing/RawVolumeData/${id}/visualization-data`,
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

  const handleMotionRequest = async (id: Number | undefined) => {
    if (!id) {
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
        `preprocessing/RawVolumeData/${id}/motion-correctness`,
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

  const handleTiltSeriesAlignment = async (id: Number | undefined) => {
    if (!id) {
      return;
    }

    let toastId = null;

    try {
      toastId = toast.loading("Applying Tilt Series Alignment...");

      const tiltSeriesSettings = {
        peak: Number(peak),
        diff: Number(diff),
        grow: Number(grow),
        iterationsTSA: Number(iterationsTSA),
        patchSizeTSA: Number(patchSizeTSA),
        patchRadius: Number(patchRadius),
        pixSizeTSA: Number(pixSizeTSA),
        patchPixSize: Number(patchPixSize),
      };

      const response = await Utils.sendReq(
        `preprocessing/RawVolumeData/${id}/tilt-series-alignment`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(tiltSeriesSettings),
        }
      );

      const blob = await response.blob();

      let filename = "tilted-aligned-series.zip";
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
        render: "Tilted Series Aligned succesfully!",
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

  return open ? (
    <div className={globalClasses.leftSidebar}>
      <div className={globalClasses.sidebarContents}>
        <div className={globalClasses.sidebarHeader}>
          <h1>Pre Processing</h1>
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
          {/* Motion Correction */}
          <h2>Tilt Series Alignment</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Label htmlFor="peak">Peak: [{Number(peak)}]</Label>
            <Slider
              id="peak"
              min={1}
              max={10}
              step={1}
              value={Number(peak)}
              onChange={(_, data) => setPeak(data.value.toString())}
            />

            <Label htmlFor="diff">Difference: [{Number(diff)}]</Label>
            <Slider
              id="peak"
              min={3}
              max={6}
              step={1}
              value={Number(diff)}
              onChange={(_, data) => setDiff(data.value.toString())}
            />

            <Label htmlFor="peak">Grow: [{Number(grow)}]</Label>
            <Slider
              id="grow"
              min={1}
              max={5}
              step={1}
              value={Number(grow)}
              onChange={(_, data) => setGrow(data.value.toString())}
            />

            <Label htmlFor="iterations">
              Iterations: [{Number(iterationsTSA)}]
            </Label>
            <Slider
              id="iterations"
              min={1}
              max={5}
              step={1}
              value={Number(iterationsTSA)}
              onChange={(_, data) => setIterationsTSA(data.value.toString())}
            />

            <Label htmlFor="patchSize">
              Patch Size: [{Number(patchSize)}] x [{Number(patchSize)}]
            </Label>
            <Slider
              id="patchSize"
              min={1}
              max={10}
              step={1}
              value={Number(patchSize)}
              onChange={(_, data) => setPatchSize(data.value.toString())}
            />

            <Label htmlFor="patchSizePX">
              Patch Size in Pixels: [{Number(patchPixSize)}] x [
              {Number(patchPixSize)}]
            </Label>
            <Slider
              id="patchSize"
              min={1}
              max={10}
              step={1}
              value={Number(patchPixSize)}
              onChange={(_, data) => setPatchPixSize(data.value.toString())}
            />

            <Label htmlFor="patchRadius">
              Patch Radius: [{Number(patchRadius)}]
            </Label>
            <Slider
              id="patchSize"
              min={0.025}
              max={2}
              step={0.025}
              value={Number(patchRadius)}
              onChange={(_, data) => setPatchRadius(data.value.toString())}
            />

            {/* Visualize Button */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              <Tooltip
                content="Apply Tilt Series Alignment"
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
                  disabled={
                    selectedVolume?.rawData === undefined || isPageBusy()
                  }
                  onClick={() =>
                    handleTiltSeriesAlignment(selectedVolume?.rawData?.id)
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

          {/* Motion Correction */}
          <h2>Motion Correction</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Label htmlFor="patchSize">
              Patch Size: [{Number(patchSize)}] x [{Number(patchSize)}]
            </Label>
            <Slider
              id="patchSize"
              min={1}
              max={10}
              step={1}
              value={Number(patchSize)}
              onChange={(_, data) => setPatchSize(data.value.toString())}
            />

            <Label htmlFor="iterations">Iterations</Label>
            <Input
              id="iterations"
              type="number"
              value={iterations}
              onChange={(e) => setIterations(e.target.value)}
            />

            <Label htmlFor="tolerance">Tolerance</Label>
            <Input
              id="tolerance"
              type="number"
              step="0.001"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
            />

            <Label htmlFor="pixSize">Pixel Size</Label>
            <Input
              id="pixSize"
              type="number"
              value={pixSize}
              onChange={(e) => setPixelSize(e.target.value)}
            />

            <Label htmlFor="kV">kiloVatios (kV)</Label>
            <Input
              id="kV"
              type="number"
              value={kv}
              onChange={(e) => setKv(e.target.value)}
            />

            {/* Visualize Button */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              <Tooltip
                content="Visualize Data"
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
                  disabled={
                    selectedVolume?.rawData === undefined || isPageBusy()
                  }
                  onClick={() =>
                    handleMotionRequest(selectedVolume?.rawData?.id)
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
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "20px",
            }}
          >
            <Tooltip
              content="Visualize Data"
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
                disabled={selectedVolume?.rawData === undefined || isPageBusy()}
                onClick={() =>
                  handleVisualisationRequest(selectedVolume?.rawData?.id)
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
