import {
  tokens,
  Button,
  Tooltip,
  mergeClasses,
} from "@fluentui/react-components";
import {
  AddFilled,
  ArrowCircleLeft28Regular,
  ArrowDownload20Regular,
  ArrowSync24Regular,
  ArrowUpload20Regular,
  Delete20Regular,
} from "@fluentui/react-icons";
import { useState, useRef } from "react";
import CreateModelDialog from "./elements/CreateModelDialog";
import DeleteDialog from "@/components/shared/DeleteDialog";
import * as Utils from "@/utils/helpers";
import globalStyles from "@/components/globalStyles";
import ComboboxSearch from "@/components/shared/ComboboxSearch";
import { observer } from "mobx-react-lite";
import { useMst } from "@/stores/RootStore";
import { WriteAccessTooltipContentWrapper } from "@/components/shared/WriteAccessTooltip";
import ToastContainer from "@/utils/toastContainer";
import { getErrorMessage } from "@/utils/helpers";
import {
  checkpointRenderOption,
  checkpointTooltip,
  modelRenderOption,
  modelTooltip,
} from "@/components/shared/ComboboxOptions";

interface Props {
  open: boolean;
  close: () => void;
}

const Models = observer(({ open, close }: Props) => {
  const { user } = useMst();

  const activeProject = user.userProjects.activeProject;
  const projectModels = user.userProjects.activeProject?.projectModels;
  const selectedModelId =
    user.userProjects.activeProject?.projectModels.selectedModelId;
  const selectedModel =
    user.userProjects.activeProject?.projectModels.selectedModel;
  const modelCheckpoints =
    user.userProjects.activeProject?.projectModels.selectedModel
      ?.modelCheckpoints;
  const selectedCheckpoint =
    user.userProjects.activeProject?.projectModels.selectedModel
      ?.modelCheckpoints.selectedCheckpoint;
  const selectedCheckpointId =
    user.userProjects.activeProject?.projectModels.selectedModel
      ?.modelCheckpoints.selectedCheckpointId;
  const checkpoints =
    user.userProjects.activeProject?.projectModels.selectedModel
      ?.modelCheckpoints.checkpoints;

  const globalClasses = globalStyles();

  const [isCreateModelDialogOpen, setIsCreateModelDialogOpen] = useState(false);
  const [modelName, setModelName] = useState("");
  const [modelDescription, setModelDescription] = useState("");
  const [deleteModelDialogOpen, setDeleteModelDialogOpen] = useState(false);
  const [deleteCheckpointDialogOpen, setDeleteCheckpointDialogOpen] =
    useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingCheckpoints, setIsLoadingCheckpoints] = useState(false);

  // Ref for checkpoint file input
  const checkpointFileRef = useRef<HTMLInputElement | null>(null);

  const isPageBusy = () => {
    return isLoadingModels || isLoadingCheckpoints;
  };

  const openCreateModelDialog = () => {
    setIsCreateModelDialogOpen(true);
  };

  const closeCreateModelDialog = () => {
    setIsCreateModelDialogOpen(false);
  };

  const handleCloseModelDialog = () => {
    setDeleteModelDialogOpen(false);
  };

  const handleCloseCheckpointDialog = () => {
    setDeleteCheckpointDialogOpen(false);
  };

  const handleCreateModel = async () => {
    if (!projectModels) {
      return;
    }
    try {
      if (projectModels.createModelActiveRequest) {
        throw new Error("Model deletion already in progress.");
      }
      projectModels.setCreateModelActiveRequest(true);
      await projectModels.createModel(modelName, modelDescription);
      setIsCreateModelDialogOpen(false);
    } catch (error) {
      console.error("Error:", error);
      const toastContainer = new ToastContainer();
      toastContainer.error(getErrorMessage(error));
    }
    projectModels.setCreateModelActiveRequest(false);
  };

  const handleModelSelect = (value: string | null) => {
    try {
      if (!value) {
        return;
      }
      projectModels?.setSelectedModelId(Number(value));
    } catch (error) {
      const toastContainer = new ToastContainer();
      toastContainer.error(getErrorMessage(error));
      console.error(error);
    }
  };

  const handleCheckpointSelect = (value: string | null) => {
    try {
      if (!value) {
        return;
      }
      modelCheckpoints?.setSelectedCheckpointId(Number(value));
    } catch (error) {
      const toastContainer = new ToastContainer();
      toastContainer.error(getErrorMessage(error));
      console.error(error);
    }
  };

  const handleCheckpointFileChange = async (event: FileChangeEvent) => {
    const toastContainer = new ToastContainer();
    try {
      toastContainer.loading("Uploading checkpoint(s)");
      await modelCheckpoints?.uploadCheckpoints(event.target.files);
      toastContainer.success("Checkpoint(s) uploaded");
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(Utils.getErrorMessage(error));
    } finally {
      if (checkpointFileRef.current) {
        checkpointFileRef.current.value = "";
      }
    }
  };

  const handleRemoveModel = async () => {
    if (selectedModelId === undefined || !projectModels) {
      return;
    }
    const toastContainer = new ToastContainer();
    try {
      if (projectModels.createModelActiveRequest) {
        throw new Error("Model deletion already in progress.");
      }
      projectModels.setDeleteModelActiveRequest(true);
      await projectModels.removeModel(selectedModelId);
      toastContainer.success("Model deleted!");
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(getErrorMessage(error));
    }
    projectModels.setDeleteModelActiveRequest(false);
    setDeleteModelDialogOpen(false);
  };

  // Function to remove the selected checkpoint
  const handleRemoveCheckpoint = async () => {
    const toastContainer = new ToastContainer();
    if (selectedCheckpointId === undefined || !modelCheckpoints) {
      return;
    }
    try {
      if (modelCheckpoints.deleteModelCheckpointActiveRequset) {
        throw new Error("Checkpoint deletion already in progress.");
      }
      modelCheckpoints.setDeleteModelCheckpointActiveRequset(true);

      await modelCheckpoints.removeCheckpoint(selectedCheckpointId);
      toastContainer.success("Checkpoint deleted!");
    } catch (error) {
      console.error("Error:", error);
      toastContainer.error(getErrorMessage(error));
    }
    modelCheckpoints.setDeleteModelCheckpointActiveRequset(false);
    setDeleteCheckpointDialogOpen(false);
  };

  // Function to handle checkpoint download
  const handleDownloadCheckpoint = async () => {
    try {
      if (selectedCheckpointId === undefined) {
        return;
      }
      await Utils.downloadFileFromServer(
        `checkpoint/${selectedCheckpointId}/download`
      );
    } catch (error) {
      const toastContainer = new ToastContainer();
      console.error("Error:", error);
      toastContainer.error(getErrorMessage(error));
    }
  };

  const refreshModels = async () => {
    try {
      setIsLoadingModels(true);
      await projectModels?.refreshModels();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const refreshCheckpoints = async () => {
    try {
      setIsLoadingCheckpoints(true);
      await modelCheckpoints?.refreshCheckpoints();
    } catch (error) {
      console.error("Error:", error);
      const toastContainer = new ToastContainer();
      toastContainer.error(getErrorMessage(error));
    } finally {
      setIsLoadingCheckpoints(false);
    }
  };

  return (
    <div
      className={mergeClasses(
        globalClasses.leftSidebar,
        !open && globalClasses.invisible
      )}
      aria-hidden={!open}
    >
      <div className={globalClasses.sidebarContents}>
        <div className={globalClasses.sidebarHeader}>
          <h1>Neural Models</h1>
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
          <h2 className={globalClasses.sectionTitle}>Model</h2>

          {/* Dropdown for selecting project models */}
          <div className={globalClasses.drowdownActionsContainer}>
            <ComboboxSearch
              selectionList={projectModels?.modelComboboxOptions ?? []}
              selectedOption={selectedModel?.comboboxOption}
              onOptionSelect={handleModelSelect}
              renderOption={modelRenderOption}
              renderTooltipContent={modelTooltip}
              placeholder="Select a model"
              noOptionsMessage="No models match your search."
              className={globalClasses.selectionDropdown}
              disabled={
                isPageBusy() || !projectModels || projectModels.models.size < 1
              }
            />
            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={"Add a New Model"}
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
                onClick={openCreateModelDialog}
              />
            </Tooltip>
            <Tooltip
              content="Refresh model data."
              relationship="label"
              hideDelay={0}
            >
              <Button
                className={globalClasses.sideActionButton}
                appearance="subtle"
                icon={
                  <ArrowSync24Regular
                    className={mergeClasses(isLoadingModels && "spinning-icon")}
                  />
                }
                disabled={isPageBusy()}
                onClick={() => void refreshModels()}
              />
            </Tooltip>
          </div>

          <div
            className={globalClasses.actionButtonRow}
            style={{ justifyContent: "flex-start", columnGap: "16px" }}
          >
            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={
                    "Upload one or more checkpoints. Checkpoints must be in PyTorch .ckpt format and can be a part of a .zip archive."
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
                className={mergeClasses(globalClasses.actionButton)}
                disabled={
                  isPageBusy() ||
                  !activeProject?.hasWriteAccess ||
                  selectedModelId === undefined
                }
                onClick={() => checkpointFileRef.current?.click()}
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <ArrowUpload20Regular />
                </div>
                <div className="buttonText">Upload Checkpoint(s)</div>
              </Button>
            </Tooltip>

            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={"Remove Model from the Project"}
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
                  selectedModelId !== undefined &&
                    globalClasses.actionButtonDelete
                )}
                disabled={
                  selectedModelId === undefined ||
                  isPageBusy() ||
                  !activeProject?.hasWriteAccess
                }
                onClick={() => setDeleteModelDialogOpen(true)}
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <Delete20Regular />
                </div>
                <div className="buttonText">Remove</div>
              </Button>
            </Tooltip>
          </div>

          <input
            type="file"
            onChange={(e) => void handleCheckpointFileChange(e)}
            accept=".ckpt, .zip"
            multiple
            ref={checkpointFileRef}
            className={globalClasses.hiddenInput}
          />

          <DeleteDialog
            TitleText={"Remove Model?"}
            BodyText={
              "Do you want to remove the selected model from the active project?"
            }
            open={deleteModelDialogOpen}
            onClose={handleCloseModelDialog}
            onConfirm={() => void handleRemoveModel()}
            isActive={!!projectModels?.deleteModelActiveRequest}
          />

          {/* Horizontal Line */}
          <hr
            style={{
              margin: "2px 0",
              border: "1px solid",
              borderColor: tokens.colorNeutralBackground1Hover,
            }}
          />

          <h3 className={globalClasses.subSectionTitle}>Checkpoints</h3>

          {/* Dropdown for selecting checkpoints */}
          <div className={globalClasses.drowdownActionsContainer}>
            <ComboboxSearch
              selectionList={modelCheckpoints?.checkpointComboboxOptions ?? []}
              selectedOption={selectedCheckpoint?.comboboxOption}
              onOptionSelect={handleCheckpointSelect}
              renderOption={checkpointRenderOption}
              renderTooltipContent={checkpointTooltip}
              placeholder="Select a checkpoint"
              noOptionsMessage="No checkpoints match your search."
              className={globalClasses.selectionDropdown}
              disabled={
                selectedModelId === undefined ||
                isPageBusy() ||
                !checkpoints ||
                checkpoints.size < 1
              }
            />
            <Tooltip
              content="Refresh checkpoints."
              relationship="label"
              hideDelay={0}
            >
              <Button
                className={globalClasses.sideActionButton}
                appearance="subtle"
                icon={
                  <ArrowSync24Regular
                    className={mergeClasses(
                      isLoadingCheckpoints && "spinning-icon"
                    )}
                  />
                }
                disabled={selectedModelId === undefined || isPageBusy()}
                onClick={() => void refreshCheckpoints()}
              />
            </Tooltip>
          </div>

          <div
            className={globalClasses.actionButtonRow}
            style={{ justifyContent: "flex-start", columnGap: "16px" }}
          >
            <Tooltip
              content="Download Checkpoint File"
              relationship="label"
              appearance="inverted"
              hideDelay={0}
            >
              <Button
                appearance="secondary"
                className={globalClasses.actionButton}
                disabled={selectedCheckpointId === undefined}
                onClick={() => void handleDownloadCheckpoint()}
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <ArrowDownload20Regular />
                </div>
                <div className="buttonText">Download Checkpoint File</div>
              </Button>
            </Tooltip>
            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={"Remove Checkpoint from the Model"}
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
                  selectedCheckpointId !== undefined &&
                    globalClasses.actionButtonDelete
                )}
                disabled={
                  selectedCheckpointId === undefined ||
                  !activeProject?.hasWriteAccess
                }
                onClick={() => setDeleteCheckpointDialogOpen(true)}
              >
                <div className={globalClasses.actionButtonIconContainer}>
                  <Delete20Regular />
                </div>
                <div className="buttonText">Remove</div>
              </Button>
            </Tooltip>
          </div>

          <DeleteDialog
            TitleText={"Remove Checkpoint?"}
            BodyText={
              "Do you want to remove the selected checkpoint from the current model?"
            }
            open={deleteCheckpointDialogOpen}
            onClose={handleCloseCheckpointDialog}
            onConfirm={() => void handleRemoveCheckpoint()}
            isActive={!!modelCheckpoints?.deleteModelCheckpointActiveRequset}
          />
        </div>
      </div>

      {/* CreateModelDialog Component */}
      <CreateModelDialog
        open={isCreateModelDialogOpen}
        onClose={closeCreateModelDialog}
        onConfirm={() => void handleCreateModel()}
        modelName={modelName}
        setModelName={setModelName}
        modelDescription={modelDescription}
        setModelDescription={setModelDescription}
        isActive={!!projectModels?.createModelActiveRequest}
      />
    </div>
  );
});

export default Models;
