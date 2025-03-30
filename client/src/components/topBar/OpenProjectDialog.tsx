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
} from "@fluentui/react-components";
import ComboboxSearch from "../shared/ComboboxSearch";
import globalStyles from "../GlobalStyles";
import { People16Filled } from "@fluentui/react-icons";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";
import { JSX } from "react/jsx-runtime";
import { ProjectInstance } from "../../stores/userState/ProjectModel";
import { toast } from "react-toastify";

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
  const userProjects = user?.userProjects;

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

      userProjects?.setActiveProject(selectedProjectId);

      onClose();
    } catch (error) {
      toast.error("Failed to open project");
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
              <b>Description:</b> {project?.description}
            </>
          )}
        </div>
      ),
    };
  };

  const createSelectionList = () => {
    const selectionList: Array<{
      children: string;
      value: string;
      ownerId: number;
      tooltip: JSX.Element;
    }> = [];
    userProjects?.projects.forEach((project) =>
      selectionList.push(projectSelectionProperties(project))
    );
    return selectionList;
  };

  const getSelectedOption = () => {
    if (userProjects?.activeProject) {
      return projectSelectionProperties(userProjects.activeProject);
    }
    if (selectedProjectId !== undefined) {
      const project = userProjects?.projects.get(selectedProjectId);
      if (project) {
        return projectSelectionProperties(project);
      }
    }
    return undefined;
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Open Project</DialogTitle>
          <DialogContent style={{ paddingTop: "15px", paddingBottom: "15px" }}>
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
              disabled={userProjects?.projects.size === 0}
              optionToText={({ children, value, ownerId, tooltip }) => children}
              renderOption={({ children, value, ownerId, tooltip }) => (
                <Option
                  key={value}
                  value={value}
                  text={children}
                  style={{ display: "flex" }}
                >
                  {children}
                  {user?.id !== ownerId && (
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
          </DialogContent>

          <DialogActions style={{ marginTop: "35px" }}>
            <Button appearance="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!selectedProjectId}
              appearance="primary"
              onClick={handleSelectProject}
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
