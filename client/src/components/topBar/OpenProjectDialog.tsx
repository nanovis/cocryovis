import { useState } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  makeStyles,
  mergeClasses,
  Option,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import ComboboxSearch from "../shared/ComboboxSearch";
import globalStyles from "../GlobalStyles";
import { ArrowSync24Regular, People16Filled } from "@fluentui/react-icons";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";
import { JSX } from "react/jsx-runtime";
import { ProjectInstance } from "../../stores/userState/ProjectModel";
import ToastContainer from "../../utils/ToastContainer";
import { getErrorMessage } from "../../utils/Helpers";

const useStyles = makeStyles({
  combobox: {
    maxWidth: "70%",
  },
});

interface Props {
  open: boolean;
  onClose: () => void;
}

const OpenProjectDialog = observer(({ open, onClose }: Props) => {
  const { user } = useMst();
  const userProjects = user.userProjects;

  const classes = useStyles();
  const globalClasses = globalStyles();

  const [selectedProjectId, setSelectedProjectId] = useState<number>();

  const handleProjectOptionSelect = (value: string | null) => {
    if (value === null) return;

    setSelectedProjectId(Number(value));
  };

  const handleSelectProject = async () => {
    try {
      if (!selectedProjectId) return;

      await userProjects.setActiveProject(selectedProjectId);

      onClose();
    } catch (error) {
      const toastContainer = new ToastContainer();
      toastContainer.error("Failed to open project");
      console.error("Error:", error);
    }
  };

  const projectSelectionProperties = (project: ProjectInstance) => {
    return {
      children: project.name,
      value: project.id.toString(),
      ownerId: project.ownerId,
      tooltip: (
        <div className={globalClasses.selectionDropdownTooltip}>
          <b>ID:</b> {project.id}
          {project.description.length > 0 && (
            <>
              <br />
              <b>Description:</b> {project.description}
            </>
          )}
        </div>
      ),
    };
  };

  const createSelectionList = () => {
    const selectionList: {
      children: string;
      value: string;
      ownerId: number;
      tooltip: JSX.Element;
    }[] = [];
    userProjects.projects.forEach((project) =>
      selectionList.push(projectSelectionProperties(project))
    );
    return selectionList;
  };

  const getSelectedOption = () => {
    if (userProjects.activeProject) {
      return projectSelectionProperties(userProjects.activeProject);
    }
    if (selectedProjectId !== undefined) {
      const project = userProjects.projects.get(selectedProjectId);
      if (project) {
        return projectSelectionProperties(project);
      }
    }
    return undefined;
  };

  async function handleRefreshProjects() {
    try {
      await user.userProjects.fetchProjects();
    } catch (error) {
      console.error(error);
      const toastContainer = new ToastContainer();
      toastContainer.error(getErrorMessage(error));
    }
  }

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Open Project</DialogTitle>
          <DialogContent
            style={{
              paddingTop: "15px",
              paddingBottom: "15px",
              display: "flex",
            }}
          >
            <ComboboxSearch
              selectionList={createSelectionList()}
              selectedOption={getSelectedOption()}
              onOptionSelect={handleProjectOptionSelect}
              placeholder="Select a project"
              noOptionsMessage="No projects match your search."
              className={mergeClasses(
                globalClasses.selectionDropdown,
                classes.combobox
              )}
              disabled={userProjects.projects.size === 0}
              optionToText={({ children }) => children}
              renderOption={({ children, value, ownerId }) => (
                <Option
                  key={value}
                  value={value}
                  text={children}
                  style={{ display: "flex" }}
                >
                  {children}
                  {user.id !== ownerId && (
                    <People16Filled
                      style={{
                        marginLeft: "5px",
                        color: tokens.colorBrandForeground1,
                      }}
                    />
                  )}
                </Option>
              )}
            />
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
                      user.userProjects.fetchProjectsActiveRequest &&
                        "spinning-icon"
                    )}
                  />
                }
                disabled={user.userProjects.fetchProjectsActiveRequest}
                onClick={() => {
                  handleRefreshProjects().catch(console.error);
                }}
              />
            </Tooltip>
          </DialogContent>

          <DialogActions style={{ marginTop: "35px" }}>
            <Button
              appearance="secondary"
              onClick={onClose}
              disabled={user.userProjects.fetchProjectsActiveRequest}
            >
              Cancel
            </Button>
            <Button
              disabled={
                !selectedProjectId ||
                user.userProjects.fetchProjectsActiveRequest
              }
              appearance="primary"
              onClick={() => {
                handleSelectProject().catch(console.error);
              }}
            >
              Select
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
});

export default OpenProjectDialog;
