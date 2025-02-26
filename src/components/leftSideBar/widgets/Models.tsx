import {
  makeStyles,
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
import DeleteDialog from "../../shared/DeleteDialog";
import Utils from "../../../functions/Utils";
import { toast } from "react-toastify";
import globalStyles from "../../GlobalStyles";
import ComboboxSearch from "../../shared/ComboboxSearch";
import { observer } from "mobx-react-lite";
import { useMst } from "../../../stores/RootStore";
import { WriteAccessTooltipContentWrapper } from "../../shared/WriteAccessTooltip";
import { ModelInstance } from "../../../stores/userState/ModelModel";
import { CheckpointInstance } from "../../../stores/userState/CheckpointModel";

const useStyles = makeStyles({});

interface Props {
  open: boolean;
  close: () => void;
}

const Models = observer(({ open, close }: Props) => {
  const { user } = useMst();

  const activeProject = user?.userProjects.activeProject;
  const projectModels = activeProject?.projectModels;
  const selectedModelId = projectModels?.selectedModelId;
  const selectedModel = projectModels?.selectedModel;
  const modelCheckpoints = selectedModel?.modelCheckpoints;
  const selectedCheckpoint = modelCheckpoints?.selectedCheckpoint;
  const selectedCheckpointId = modelCheckpoints?.selectedCheckpointId;
  const checkpoints = modelCheckpoints?.checkpoints;

  const classes = useStyles();
  const globalClasses = globalStyles();

  const [isCreateModelDialogOpen, setCreateModelDialogOpen] = useState(false);
  const [modelName, setModelName] = useState("");
  const [modelDescription, setModelDescription] = useState("");
  const [deleteModelDialogOpen, setDeleteModelDialogOpen] = useState(false);
  const [deleteCheckpointDialogOpen, setDeleteCheckpointDialogOpen] =
    useState(false);
  const [isLoadingModels, setLoadingModels] = useState(false);
  const [isLoadingCheckpoints, setLoadingCheckpoints] = useState(false);

  // Ref for checkpoint file input
  const checkpointFileRef = useRef<HTMLInputElement | null>(null);

  const isPageBusy = () => {
    return isLoadingModels || isLoadingCheckpoints;
  };

  // Function to open the dialog
  const openCreateModelDialog = () => {
    setCreateModelDialogOpen(true);
  };

  // Function to close the dialog
  const closeCreateModelDialog = () => {
    setCreateModelDialogOpen(false);
  };

  const handleDeleteModelClick = () => {
    handleRemoveModel();
    setDeleteModelDialogOpen(false);
  };

  const handleCloseModelDialog = () => {
    setDeleteModelDialogOpen(false); // Close dialog
  };

  const handleDeleteCheckpointClick = () => {
    handleRemoveCheckpoint();
    setDeleteCheckpointDialogOpen(false);
  };

  const handleCloseCheckpointDialog = () => {
    setDeleteCheckpointDialogOpen(false); // Close dialog
  };

  // Function to handle model creation
  const handleCreateModel = async () => {
    try {
      await projectModels?.createModel(modelName, modelDescription);

      setCreateModelDialogOpen(false);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Function to handle model selection
  const handleModelSelect = async (value: string | null) => {
    try {
      if (!value) {
        return;
      }
      projectModels?.setSelectedModelId(Number(value));
    } catch (error) {
      console.error(error);
    }
  };

  // Function to handle checkpoint selection
  const handleCheckpointSelect = (value: string | null) => {
    try {
      if (!value) {
        return;
      }
      modelCheckpoints?.setSelectedCheckpointId(Number(value));
    } catch (error) {
      console.error(error);
    }
  };

  // Function to handle file change for checkpoints
  const handleCheckpointFileChange = async (event: FileChangeEvent) => {
    try {
      await modelCheckpoints?.uploadCheckpoints(event.target.files);
    } catch (error) {
      const errMsg = Utils.getErrorMessage(error);

      console.error("Error:", error);
      toast.error(errMsg);
    } finally {
      if (checkpointFileRef.current) {
        checkpointFileRef.current.value = "";
      }
    }
  };

  // Function to remove the selected model
  const handleRemoveModel = async () => {
    try {
      if (!selectedModelId) {
        return;
      }
      await projectModels?.removeModel(selectedModelId);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Function to remove the selected checkpoint
  const handleRemoveCheckpoint = async () => {
    try {
      if (!selectedCheckpointId) {
        return;
      }
      await modelCheckpoints?.removeCheckpoint(selectedCheckpointId);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Function to handle checkpoint download
  const handleDownloadCheckpoint = async () => {
    try {
      if (!selectedCheckpointId) {
        return;
      }

      const response = await Utils.sendRequestWithToast(
        `checkpoint/${selectedCheckpointId}/download`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      let filename = null;
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.indexOf("attachment") !== -1) {
        const matches = disposition.match(/filename="?([^";]+)"?/);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }
      if (filename === null) {
        throw new Error("Missing filename");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const refreshModels = async () => {
    try {
      setLoadingModels(true);
      await projectModels?.refreshModels();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoadingModels(false);
    }
  };

  const refreshCheckpoints = async () => {
    try {
      setLoadingCheckpoints(true);
      modelCheckpoints?.refreshCheckpoints();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoadingCheckpoints(false);
    }
  };

  const modelPropertyList = (model: ModelInstance) => {
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
    projectModels?.models.forEach((model) =>
      selectionList.push(modelPropertyList(model))
    );
    return selectionList;
  };

  const checkpointPropertyList = (checkpoint: CheckpointInstance) => {
    return {
      children: Utils.getFileNameFromPath(checkpoint.filePath) ?? "",
      value: checkpoint.id.toString(),
      tooltip: (
        <div className={globalClasses.selectionDropdownTooltip}>
          <b>ID:</b> {checkpoint.id}
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
    modelCheckpoints?.checkpoints.forEach((checkpoint) =>
      selectionList.push(checkpointPropertyList(checkpoint))
    );
    return selectionList;
  };

  return open ? (
    <div className={globalClasses.leftSidebar}>
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
              selectionList={modelSelectionList()}
              selectedOption={
                selectedModel ? modelPropertyList(selectedModel) : undefined
              }
              onOptionSelect={handleModelSelect}
              placeholder="Select a model"
              noOptionsMessage="No models match your search."
              className={globalClasses.selectionDropdown}
              disabled={
                isPageBusy() || !projectModels || projectModels?.models.size < 1
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
                onClick={refreshModels}
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
                  (!selectedModelId && !isPageBusy()) ||
                  !activeProject?.hasWriteAccess
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
                  !selectedModelId ||
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
            onChange={handleCheckpointFileChange}
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
            onConfirm={handleDeleteModelClick}
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
              selectionList={checkpointSelectionList()}
              selectedOption={
                selectedCheckpoint
                  ? checkpointPropertyList(selectedCheckpoint)
                  : undefined
              }
              onOptionSelect={handleCheckpointSelect}
              placeholder="Select a checkpoint"
              noOptionsMessage="No checkpoints match your search."
              className={globalClasses.selectionDropdown}
              disabled={
                !selectedModelId ||
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
                disabled={!selectedModelId || isPageBusy()}
                onClick={refreshCheckpoints}
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
                disabled={!selectedCheckpointId}
                onClick={handleDownloadCheckpoint}
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
                  !selectedCheckpointId || !activeProject?.hasWriteAccess
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
            onConfirm={handleDeleteCheckpointClick}
          />
        </div>
      </div>

      {/* CreateModelDialog Component */}
      <CreateModelDialog
        open={isCreateModelDialogOpen}
        onClose={closeCreateModelDialog}
        onConfirm={handleCreateModel}
        modelName={modelName}
        setModelName={setModelName}
        modelDescription={modelDescription}
        setModelDescription={setModelDescription}
      />
    </div>
  ) : null;
});

export default Models;
