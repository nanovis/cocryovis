//Nano-Ötzi.js
import { useState } from "react";
import type {
  OptionOnSelectData,
  AccordionToggleData,
} from "@fluentui/react-components";
import {
  makeStyles,
  tokens,
  Button,
  Tooltip,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Text,
  mergeClasses,
} from "@fluentui/react-components";
import {
  ArrowCircleLeft28Regular,
  DesktopTower20Regular,
  GlobeDesktop20Regular,
} from "@fluentui/react-icons";
import * as Utils from "@/utils/helpers";
import globalStyles from "@/components/globalStyles";
import ComboboxSearch from "@/components/shared/ComboboxSearch";
import ComboboxTagMultiselect from "@/components/shared/ComboboxTagMultiselect";
import { observer } from "mobx-react-lite";
import { useMst } from "@/stores/RootStore";
import { WriteAccessTooltipContentWrapper } from "@/components/shared/WriteAccessTooltip";
import {
  BooleanInputValidatedField,
  DropdownInputValidatedField,
  NumberInputValidatedField,
} from "@/components/shared/ValidatedFields";
import { queueInference } from "@/api/nanoOetzi";
import { getVolumeDataById, getVolumeData } from "@/api/volumeData";
import { checkpointToText } from "@/api/checkpoint";
import { createResultFromFiles } from "@/api/results";
import ToastContainer from "@/utils/toastContainer";
import {
  checkpointRenderOption,
  checkpointRenderOptionWithModel,
  checkpointTooltip,
  checkpointTooltipWithModel,
  modelRenderOption,
  modelTooltip,
  volumeRenderOption,
  volumeTooltip,
} from "@/components/shared/ComboboxOptions";

const useStyles = makeStyles({
  advancedOptionsRow: {
    display: "flex",
    flexDirection: "row",
    gap: "10px",
    justifyContent: "space-between",
  },
});

interface Props {
  open: boolean;
  close: () => void;
}

const NanoOtzi = observer(({ open, close }: Props) => {
  const { user } = useMst();
  const activeProject = user.userProjects.activeProject;
  const projectVolumes = user.userProjects.activeProject?.projectVolumes;
  const volumes = user.userProjects.activeProject?.projectVolumes.volumes;
  const projectModels = user.userProjects.activeProject?.projectModels;
  const models = user.userProjects.activeProject?.projectModels.models;
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
    projectModels?.uniqueCheckpoints.get(inferenceCheckpointId);

  const [inferenceInProgress, setInferenceInProgress] = useState(false);

  const [showAdvancedOptions, setShowAdvancedOptions] = useState<string[]>([]);

  const startInference = async () => {
    if (
      !canDoInference() ||
      inferenceCheckpointId === undefined ||
      inferenceVolumeId === undefined
    ) {
      return;
    }
    const toastContainer = new ToastContainer();

    try {
      setInferenceInProgress(true);
      await queueInference({
        checkpointId: inferenceCheckpointId,
        volumeId: inferenceVolumeId,
      });
      setInferenceInProgress(false);
      toastContainer.success("Inference queued!");
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      console.error("startInference Error:", error);
    } finally {
      setInferenceInProgress(false);
    }
  };

  const startInferenceLocal = async () => {
    if (!canDoInference()) {
      return;
    }

    const toastContainer = new ToastContainer();

    try {
      if (!window.WasmModule) {
        throw new Error("Wasm module not initialized!");
      }

      if (
        inferenceVolumeId === undefined ||
        inferenceCheckpointId === undefined
      ) {
        return;
      }

      setInferenceInProgress(true);

      const volume = volumes?.get(inferenceVolumeId);

      if (!volume) {
        throw new Error("Volume not found!");
      }
      if (!volume.rawData) {
        throw new Error("volume missing raw data");
      }

      toastContainer.loading("Fetching raw data...");

      const rawData = await getVolumeDataById(
        "RawVolumeData",
        volume.rawData.id
      );
      const arrayBuffer = await getVolumeData("RawVolumeData", rawData.id);

      const rawDataFile = new Uint8Array(arrayBuffer);

      const settings = Utils.toInferenceSettingSchema(rawData);

      const settingsFileName = settings.file.replace(/\.[^/.]+$/, "") + ".json";

      const inferenceRunnerSettings = {
        ...settings,
        ratio: { x: 1, y: 1, z: 1 },
      };

      window.WasmModule.FS.writeFile(
        settingsFileName,
        JSON.stringify(inferenceRunnerSettings)
      );

      window.WasmModule.FS.writeFile(settings.file, rawDataFile);

      const checkpointTxt = await checkpointToText(inferenceCheckpointId);

      window.WasmModule.FS.writeFile("parameters.txt", checkpointTxt);

      toastContainer.loading("Running Local Inference...");

      // This allows the toast to update, hopefully...
      await new Promise((r) => setTimeout(r, 1000));

      const volumeData = (await window.WasmModule.doInference(
        settingsFileName,
        "parameters.txt"
      )) as Uint8Array[];

      toastContainer.loading("Sending data to server...");
      const volumeDescriptors = [];

      const files: File[] = [];

      for (const [i, volume] of volumeData.entries()) {
        const blob = new Blob([new Uint8Array(volume)], {
          type: "application/octet-stream",
        });

        const fileName = `volume_${i}`;
        const rawFileName = `${fileName}.raw`;

        files.push(new File([blob], rawFileName));

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

      await createResultFromFiles(volume.id, {
        idCheckpoint: inferenceCheckpointId,
        volumeDescriptors: volumeDescriptors,
        files: {
          files: files,
        },
      });

      toastContainer.success("Local Inference Successful!");

      setInferenceInProgress(false);
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      console.error("Local Inference Error:", error);
    } finally {
      setInferenceInProgress(false);
    }
  };

  const handleInferenceVolumeSelect = (value: string | null) => {
    if (!value) {
      return;
    }

    setInferenceVolumeId(Number(value));
  };

  const handleInferenceCheckpointSelect = (value: string | null) => {
    if (!value) {
      return;
    }

    setInferenceCheckpointId(Number(value));
  };

  const handleTrainingModelSelect = (value: string | null) => {
    if (!value || !models) {
      return;
    }
    const model = models.get(Number(value));
    if (!model) {
      return;
    }
    modelTraining.setModel(model);
  };

  const handleTrainingCheckpointSelect = (value: string | null) => {
    if (value === null) {
      modelTraining.setCheckpointId(undefined);
      return;
    }
    if (!modelTraining.model) {
      return;
    }
    const checkpointId = parseInt(value);
    if (isNaN(checkpointId)) {
      return;
    }
    modelTraining.setCheckpointId(checkpointId);
  };

  const canDoInference = () => {
    return (
      !inferenceInProgress &&
      inferenceCheckpointId !== undefined &&
      inferenceVolumeId !== undefined
    );
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

  const onTrainingVolumeTagClick = (_option: string, index: number) => {
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

  const onValidationVolumeTagClick = (_option: string, index: number) => {
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

  const onTestingVolumeTagClick = (_option: string, index: number) => {
    modelTraining.removeTestingVolumeByIndex(index);
  };

  return (
    <div
      className={mergeClasses(
        globalClasses.leftSidebar,
        !open && globalClasses.invisible
      )}
      aria-hidden={!open}
    >
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
              selectionList={projectVolumes?.volumeComboboxOptions ?? []}
              selectedOption={
                inferenceVolume ? inferenceVolume.comboboxOption : undefined
              }
              onOptionSelect={handleInferenceVolumeSelect}
              renderOption={volumeRenderOption}
              renderTooltipContent={volumeTooltip}
              placeholder="Select a volume"
              noOptionsMessage="No volumes match your search."
              optionToText={({ children }) => children}
              disabled={!volumes || volumes.size < 1}
            />
            <ComboboxSearch
              selectionList={projectModels?.checkpointsComboboxOptions ?? []}
              selectedOption={
                inferenceCheckpoint
                  ? {
                      ...inferenceCheckpoint.checkpoint.comboboxOption,
                      modelName: inferenceCheckpoint.model.name,
                    }
                  : undefined
              }
              onOptionSelect={handleInferenceCheckpointSelect}
              renderOption={checkpointRenderOptionWithModel}
              renderTooltipContent={checkpointTooltipWithModel}
              placeholder="Select a checkpoint"
              noOptionsMessage="No checkpoints match your search."
              optionToText={({ children }) => children}
              disabled={!models || models.size < 1}
            />
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
                onClick={() => void startInferenceLocal()}
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
                onClick={() => void startInference()}
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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              rowGap: "20px",
            }}
          >
            <h2 className={globalClasses.sectionTitle} style={{ marginTop: 0 }}>
              Training
            </h2>
            <ComboboxSearch
              selectionList={projectModels?.modelComboboxOptions ?? []}
              selectedOption={modelTraining.model?.comboboxOption}
              onOptionSelect={handleTrainingModelSelect}
              renderOption={modelRenderOption}
              renderTooltipContent={modelTooltip}
              placeholder="Select a model"
              noOptionsMessage="No models match your search."
              optionToText={({ children }) => children}
              disabled={!models || models.size < 0}
            />

            <Tooltip
              content={{
                children: "Select a model first.",
                className: modelTraining.model && globalClasses.invisible,
              }}
              relationship="label"
              appearance="inverted"
              hideDelay={0}
            >
              <div>
                <ComboboxSearch
                  selectionList={
                    modelTraining.model?.modelCheckpoints
                      .checkpointComboboxOptions ?? []
                  }
                  selectedOption={
                    modelTraining.checkpointId !== undefined
                      ? modelTraining.model?.modelCheckpoints.checkpoints.get(
                          modelTraining.checkpointId
                        )?.comboboxOption
                      : undefined
                  }
                  onOptionSelect={handleTrainingCheckpointSelect}
                  renderOption={checkpointRenderOption}
                  renderTooltipContent={checkpointTooltip}
                  placeholder="Select a checkpoint (optional)"
                  noOptionsMessage="No checkpoints match your search."
                  optionToText={({ children }) => children}
                  disabled={!modelTraining.model}
                  clearable={true}
                />
              </div>
            </Tooltip>

            <Accordion
              openItems={showAdvancedOptions}
              onToggle={(_, data: AccordionToggleData<string>) => {
                setShowAdvancedOptions(data.openItems);
              }}
              collapsible
            >
              <AccordionItem value="1" style={{ marginBottom: "12px" }}>
                <AccordionHeader>
                  <Text> Advanced Options</Text>
                </AccordionHeader>
                <AccordionPanel
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    rowGap: "10px",
                    margin: "0 2px",
                  }}
                >
                  <div className={classes.advancedOptionsRow}>
                    <NumberInputValidatedField
                      input={modelTraining.minEpochsInput}
                      style={{ flex: 1 }}
                    />
                    <NumberInputValidatedField
                      input={modelTraining.maxEpochsInput}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div
                    className={classes.advancedOptionsRow}
                    style={{
                      alignItems: "flex-end",
                    }}
                  >
                    <NumberInputValidatedField
                      input={modelTraining.learningRateInput}
                      style={{ flex: 1 }}
                      disabled={modelTraining.findLearningRate}
                    />
                    <BooleanInputValidatedField
                      input={modelTraining.findLearningRateInput}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div className={classes.advancedOptionsRow}>
                    <NumberInputValidatedField
                      input={modelTraining.batchSizeInput}
                      style={{ flex: 1 }}
                    />
                    <NumberInputValidatedField
                      input={modelTraining.accumulateGradientsInput}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div className={classes.advancedOptionsRow}>
                    <DropdownInputValidatedField
                      input={modelTraining.optimizerInput}
                      style={{ flex: 1 }}
                    />
                    <DropdownInputValidatedField
                      input={modelTraining.lossInput}
                      style={{ flex: 1 }}
                    />
                  </div>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>

            <ComboboxTagMultiselect
              selectionList={modelTraining.trainingVolumeOptions.map(
                (volume) => volume.comboboxOption
              )}
              selectedOptions={modelTraining.trainingVolumeIds}
              onOptionSelect={onTrainingVolumeSelect}
              onTagClick={onTrainingVolumeTagClick}
              textState={modelTraining.trainingVolumeNames}
              title="Training Volumes"
              placeholder="Select one or more training volumes"
              noOptionsMessage="No volumes match your search."
              optionToText={({ children }) => children}
            />

            <ComboboxTagMultiselect
              selectionList={modelTraining.validationVolumeOptions.map(
                (volume) => volume.comboboxOption
              )}
              selectedOptions={modelTraining.validationVolumeIds}
              onOptionSelect={onValidationVolumeSelect}
              onTagClick={onValidationVolumeTagClick}
              textState={modelTraining.validationVolumeNames}
              title="Validation Volumes"
              placeholder="Select one or more validation volumes"
              noOptionsMessage="No volumes match your search."
              optionToText={({ children }) => children}
            />

            <ComboboxTagMultiselect
              selectionList={modelTraining.testingVolumeOptions.map(
                (volume) => volume.comboboxOption
              )}
              selectedOptions={modelTraining.testingVolumeIds}
              onOptionSelect={onTestingVolumeSelect}
              onTagClick={onTestingVolumeTagClick}
              textState={modelTraining.testingVolumeNames}
              title="Testing Volumes"
              placeholder="Select one or more testing volumes"
              noOptionsMessage="No volumes match your search."
              optionToText={({ children }) => children}
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
                onClick={() => void modelTraining.startTraining()}
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
    </div>
  );
});

export default NanoOtzi;
