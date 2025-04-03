//Nano-Ötzi.js
import { useState } from "react";
import {
  makeStyles,
  tokens,
  Button,
  Tooltip,
  SelectionEvents,
  OptionOnSelectData,
} from "@fluentui/react-components";
import {
  ArrowCircleLeft28Regular,
  DesktopTower20Regular,
  GlobeDesktop20Regular,
} from "@fluentui/react-icons";
import Utils from "../../../functions/Utils";
import { toast } from "react-toastify";
import globalStyles from "../../GlobalStyles";
import ComboboxSearch from "../../shared/ComboboxSearch";
import ComboboxTagMultiselect from "../../shared/ComboboxTagMultiselect";
import { observer } from "mobx-react-lite";
import { useMst } from "../../../stores/RootStore";
import { WriteAccessTooltipContentWrapper } from "../../shared/WriteAccessTooltip";
import { VolumeInstance } from "../../../stores/userState/VolumeModel";
import { CheckpointInstance } from "../../../stores/userState/CheckpointModel";
import { ModelInstance } from "../../../stores/userState/ModelModel";

const useStyles = makeStyles({});

interface Props {
  open: boolean;
  close: () => void;
}

const NanoOtzi = observer(({ open, close }: Props) => {
  const { user } = useMst();
  const activeProject = user.userProjects.activeProject;
  const projectVolumes = activeProject?.projectVolumes;
  const volumes = projectVolumes?.volumes;
  const projectModels = activeProject?.projectModels;
  const models = projectModels?.models;
  const modelTraining = user.modelTraining;

  const classes = useStyles();
  const globalClasses = globalStyles();

  const [inferenceVolumeId, setInferenceVolumeId] = useState<
    number | undefined
  >(undefined);
  const inferenceVolume = inferenceVolumeId && volumes?.get(inferenceVolumeId);

  const [inferenceCheckpointId, setInferenceCheckpointId] = useState<
    number | undefined
  >(undefined);
  const inferenceCheckpoint =
    inferenceCheckpointId &&
    projectModels?.uniqueCheckpoints?.get(inferenceCheckpointId);

  const [inferenceInProgress, setInferenceInProgress] = useState(false);

  const startInference = async () => {
    if (!canDoInference()) {
      return;
    }
    try {
      setInferenceInProgress(true);
      await Utils.sendRequestWithToast(
        `queue-inference`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkpointId: inferenceCheckpointId,
            volumeId: inferenceVolumeId,
          }),
        },
        { successText: "Inference successfuly queued!" },
      );
      setInferenceInProgress(false);
    } catch (error) {
      console.error("startInference Error:", error);
    }
  };

  const startInferenceLocal = async () => {
    if (!canDoInference()) {
      return;
    }

    let toastId = null;

    try {
      if (!window.WasmModule) {
        throw new Error("Wasm module not initialized!");
      }

      if (!inferenceVolumeId || !inferenceCheckpointId) {
        return;
      }

      setInferenceInProgress(true);

      const volume = volumes?.get(inferenceVolumeId);

      if (!volume) {
        throw new Error("Volume not found!");
      }

      toastId = toast.loading("Fetching raw data...");

      let response = await Utils.sendReq(
        `volumeData/RawVolumeData/${volume.rawDataId}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      const rawData = await response.json();

      response = await Utils.sendReq(
        `volumeData/RawVolumeData/${rawData.id}/data`,
        {
          method: "GET",
          credentials: "include",
        },
        false,
      );

      const arrayBuffer = await response.arrayBuffer();
      const rawDataFile = new Uint8Array(arrayBuffer);

      const settings = JSON.parse(rawData.settings);

      const settingsFileName = settings.file.replace(/\.[^/.]+$/, "") + ".json";

      window.WasmModule?.FS.writeFile(settingsFileName, rawData.settings);

      window.WasmModule?.FS.writeFile(settings.file, rawDataFile);

      response = await Utils.sendReq(
        `checkpoint/${inferenceCheckpointId}/as-text`,
        {
          method: "GET",
          credentials: "include",
        },
        false,
      );

      const checkpointTxt = await response.text();

      window.WasmModule?.FS.writeFile("parameters.txt", checkpointTxt);

      toast.update(toastId, {
        render: "Running Local Inference...",
        isLoading: true,
        autoClose: false,
      });
      // This allows the toast to update, hopefully...
      await new Promise((r) => setTimeout(r, 1000));

      const volumeData = await window.WasmModule?.doInference(
        settingsFileName,
        "parameters.txt",
      );

      toast.update(toastId, {
        render: "Sending data to server...",
        isLoading: true,
        autoClose: false,
      });

      const volumeDescriptors = [];

      var formData = new FormData();
      for (const [i, volume] of volumeData.entries()) {
        const blob = new Blob([volume], {
          type: "application/octet-stream",
        });

        const fileName = `volume_${i}`;
        const rawFileName = `${fileName}.raw`;

        formData.append("files", blob, rawFileName);

        const volSettings = { ...settings };
        volSettings.file = rawFileName;
        switch (i) {
          case 0:
            volumeDescriptors.push({
              name: "Background",
              index: 4,
            });
            break;
          case 1:
            volumeDescriptors.push({
              name: "Membrane",
              index: 1,
            });
            break;
          case 2:
            volumeDescriptors.push({
              name: "Spikes",
              index: 0,
            });
            break;

          case 3:
            volumeDescriptors.push({
              name: "Inner",
              index: 2,
            });
            break;
        }
      }

      formData.append(
        "data",
        JSON.stringify({
          idVolumeData: rawData.id,
          idCheckpoint: inferenceCheckpointId,
          volumeDescriptors: volumeDescriptors,
        }),
      );

      await Utils.sendReq(
        `volume/${volume.id}/results`,
        {
          method: "POST",
          body: formData,
        },
        false,
      );

      toast.update(toastId, {
        render: "Local Inference Successful!",
        type: "success",
        isLoading: false,
        autoClose: 2000,
        closeOnClick: true,
      });

      setInferenceInProgress(false);
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Local Inference Error:", error);
    }
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
    volumes?.forEach((volume) =>
      selectionList.push(volumeSelectionProperties(volume)),
    );
    return selectionList;
  };

  const handleInferenceVolumeSelect = (value: string | null) => {
    if (!value) {
      return;
    }

    setInferenceVolumeId(Number(value));
  };

  const checkpointSelectionProperties = (
    checkpoint: CheckpointInstance,
    models: ModelInstance[],
  ) => {
    return {
      children: Utils.getFileNameFromPath(checkpoint.filePath) ?? "",
      value: checkpoint.id.toString(),
      tooltip: (
        <div className={globalClasses.selectionDropdownTooltip}>
          <b>ID:</b> {checkpoint.id}
          <br />
          <b>Model: </b> {models.map((model) => model.name).join(", ")}
        </div>
      ),
    };
  };

  const checkpointSelectionList = () => {
    const selectionList: Array<{
      children: string;
      value: string;
      tooltip: JSX.Element;
    }> = [];
    projectModels?.uniqueCheckpoints.forEach(({ checkpoint, models }) =>
      selectionList.push(checkpointSelectionProperties(checkpoint, models)),
    );
    return selectionList;
  };

  const handleInferenceCheckpointSelect = (value: string | null) => {
    if (!value) {
      return;
    }

    setInferenceCheckpointId(Number(value));
  };

  const modelSelectionProperties = (model: ModelInstance) => {
    return {
      children: model.name,
      value: model.id.toString(),
      tooltip: (
        <div className={globalClasses.selectionDropdownTooltip}>
          <b>ID:</b> {model.id}
          {model.description.length > 0 && (
            <>
              <br />
              <b>Description:</b> {model?.description}
            </>
          )}
        </div>
      ),
    };
  };

  const modelSelectionList = () => {
    const selectionList: Array<{
      children: string;
      value: string;
      tooltip: JSX.Element;
    }> = [];
    models?.forEach((model) =>
      selectionList.push(modelSelectionProperties(model)),
    );
    return selectionList;
  };

  const handleTrainingModelSelect = (value: string | null) => {
    if (!value || !models) {
      return;
    }
    const model = models.get(Number(value));
    if (!model) {
      return;
    }
    modelTraining?.setModel(model);
  };

  const canDoInference = () => {
    return !inferenceInProgress && inferenceCheckpointId && inferenceVolumeId;
  };

  const onTrainingVolumeSelect = (data: OptionOnSelectData | null) => {
    if (data?.optionValue === undefined) return;
    const volume = volumes?.get(Number(data.optionValue));
    if (!volume) return;

    if (modelTraining.trainingVolumes.includes(volume)) {
      modelTraining.removeTrainingVolume(volume);
    } else {
      modelTraining.addTrainingVolume(volume);
    }
  };

  const onTrainingVolumeTagClick = (option: string, index: number) => {
    modelTraining.removeTrainingVolumeByIndex(index);
  };

  const onValidationVolumeSelect = (data: OptionOnSelectData | null) => {
    if (data?.optionValue === undefined) return;
    const volume = volumes?.get(Number(data.optionValue));
    if (!volume) return;

    if (modelTraining.validationVolumes.includes(volume)) {
      modelTraining.removeValidationVolume(volume);
    } else {
      modelTraining.addValidationVolume(volume);
    }
  };

  const onValidationVolumeTagClick = (option: string, index: number) => {
    modelTraining.removeValidationVolumeByIndex(index);
  };

  const onTestingVolumeSelect = (data: OptionOnSelectData | null) => {
    if (data?.optionValue === undefined) return;
    const volume = volumes?.get(Number(data.optionValue));
    if (!volume) return;

    if (modelTraining.testingVolumes.includes(volume)) {
      modelTraining.removeTestingVolume(volume);
    } else {
      modelTraining.addTestingVolume(volume);
    }
  };

  const onTestingVolumeTagClick = (option: string, index: number) => {
    modelTraining.removeTestingVolumeByIndex(index);
  };

  return open ? (
    <div className={globalClasses.leftSidebar}>
      <div
        className={globalClasses.sidebarContents}
        style={{ marginBottom: "15px" }}
      >
        <div className={globalClasses.sidebarHeader}>
          <h1>Neural Training and Inference</h1>
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
          <h2 className={globalClasses.sectionTitle}>Inference</h2>
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              rowGap: "20px",
              justifyContent: "space-between",
            }}
          >
            <ComboboxSearch
              selectionList={volumeSelectionList()}
              selectedOption={
                inferenceVolume
                  ? volumeSelectionProperties(inferenceVolume)
                  : undefined
              }
              onOptionSelect={handleInferenceVolumeSelect}
              placeholder="Select a volume"
              noOptionsMessage="No volumes match your search."
              optionToText={({ children, value, tooltip }) => children}
              disabled={!volumes || volumes.size < 1}
            ></ComboboxSearch>
            <ComboboxSearch
              selectionList={checkpointSelectionList()}
              selectedOption={
                inferenceCheckpoint
                  ? checkpointSelectionProperties(
                      inferenceCheckpoint.checkpoint,
                      inferenceCheckpoint.models,
                    )
                  : undefined
              }
              onOptionSelect={handleInferenceCheckpointSelect}
              placeholder="Select a checkpoint"
              noOptionsMessage="No checkpoints match your search."
              optionToText={({ children, value, tooltip }) => children}
              disabled={!models || models.size < 1}
            ></ComboboxSearch>
          </div>

          <div
            className={globalClasses.actionButtonRow}
            style={{ justifyContent: "space-between", columnGap: "30px" }}
          >
            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={"Start Inference on the this machine."}
                  hasWriteAccess={activeProject?.hasWriteAccess}
                />
              }
              relationship="label"
              appearance="inverted"
              hideDelay={0}
            >
              <Button
                appearance="primary"
                className={globalClasses.actionButton}
                disabled={!canDoInference() || !activeProject?.hasWriteAccess}
                onClick={startInferenceLocal}
                style={{ flex: 1 }}
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <DesktopTower20Regular />
                </div>
                <div className="buttonText">Start Inference (Local)</div>
              </Button>
            </Tooltip>
            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={
                    "Start Inference on the server. Server can process only a single request at the time. Your position in the request queue and status of the request can be observed in the Status widget."
                  }
                  hasWriteAccess={activeProject?.hasWriteAccess}
                />
              }
              relationship="label"
              appearance="inverted"
              hideDelay={0}
            >
              <Button
                appearance="secondary"
                className={globalClasses.actionButton}
                disabled={!canDoInference() || !activeProject?.hasWriteAccess}
                onClick={startInference}
                style={{ flex: 1 }}
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <GlobeDesktop20Regular />
                </div>
                <div className="buttonText">Start Inference (Server)</div>
              </Button>
            </Tooltip>
          </div>

          <hr
            style={{
              margin: "12px 0",
              border: "1px solid",
              borderColor: tokens.colorNeutralBackground1Hover,
            }}
          />

          <h2 className={globalClasses.sectionTitle} style={{ marginTop: 0 }}>
            Training
          </h2>
          <ComboboxSearch
            selectionList={modelSelectionList()}
            selectedOption={
              modelTraining?.model !== undefined
                ? modelSelectionProperties(modelTraining.model)
                : undefined
            }
            onOptionSelect={handleTrainingModelSelect}
            placeholder="Select a model"
            noOptionsMessage="No models match your search."
            optionToText={({ children, value, tooltip }) => children}
            disabled={!models || models.size < 0}
          />

          <ComboboxTagMultiselect
            selectionList={modelTraining.trainingVolumeOptions.map((volume) =>
              volumeSelectionProperties(volume),
            )}
            selectedOptions={modelTraining.trainingVolumeIds}
            onOptionSelect={onTrainingVolumeSelect}
            onTagClick={onTrainingVolumeTagClick}
            textState={modelTraining.trainingVolumeNames}
            title="Training Volumes"
            placeholder="Select one or more training volumes"
            noOptionsMessage="No volumes match your search."
            optionToText={({ children, value, tooltip }) => children}
          />

          <ComboboxTagMultiselect
            selectionList={modelTraining?.validationVolumeOptions.map(
              (volume) => volumeSelectionProperties(volume),
            )}
            selectedOptions={modelTraining.validationVolumeIds}
            onOptionSelect={onValidationVolumeSelect}
            onTagClick={onValidationVolumeTagClick}
            textState={modelTraining.validationVolumeNames}
            title="Validation Volumes"
            placeholder="Select one or more validation volumes"
            noOptionsMessage="No volumes match your search."
            optionToText={({ children, value, tooltip }) => children}
          />

          <ComboboxTagMultiselect
            selectionList={modelTraining?.testingVolumeOptions.map((volume) =>
              volumeSelectionProperties(volume),
            )}
            selectedOptions={modelTraining?.testingVolumeIds}
            onOptionSelect={onTestingVolumeSelect}
            onTagClick={onTestingVolumeTagClick}
            textState={modelTraining.testingVolumeNames}
            title="Testing Volumes"
            placeholder="Select one or more testing volumes"
            noOptionsMessage="No volumes match your search."
            optionToText={({ children, value, tooltip }) => children}
          />

          <Tooltip
            content={
              <WriteAccessTooltipContentWrapper
                content={
                  "Start model training on the server. Server can process only a single request at the time. Your position in the request queue and status of the request can be observed in the Status widget."
                }
                hasWriteAccess={activeProject?.hasWriteAccess}
              />
            }
            relationship="label"
            appearance="inverted"
            hideDelay={0}
          >
            <Button
              appearance="primary"
              className={globalClasses.actionButton}
              disabled={
                !modelTraining.canDoTraining || !activeProject?.hasWriteAccess
              }
              onClick={modelTraining.startTraining}
              style={{ flexGrow: 1 }}
            >
              <div className={globalClasses.actionButtonIconContainer}>
                <GlobeDesktop20Regular />
              </div>
              <div className="buttonText">Start Training (Server)</div>
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  ) : null;
});

export default NanoOtzi;
