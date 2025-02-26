import { useState } from "react";

import {
  makeStyles,
  tokens,
  mergeClasses,
  Tooltip,
  Button,
} from "@fluentui/react-components";
import {
  Cube24Regular,
  BrainCircuit24Regular,
  Molecule24Regular,
  Status24Regular,
  Delete24Regular,
  DesktopTower24Regular,
} from "@fluentui/react-icons";
import DeleteDialog from "../shared/DeleteDialog";
import { useMst } from "../../stores/RootStore";
import { observer } from "mobx-react-lite";
import globalStyles from "../GlobalStyles";

const useStyles = makeStyles({
  icon: {
    color: tokens.colorBrandForeground1,
  },
});

interface Props {
  openIcons: boolean[];
  toggleIcons: (id: number) => void;
}

const IconBar = observer(({ openIcons, toggleIcons }: Props) => {
  const { user } = useMst();

  const classes = useStyles();
  const globalClasses = globalStyles();

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDeleteClick = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    try {
      const activeProjectId = user?.userProjects.activeProjectId;
      if (!activeProjectId) {
        return;
      }
      await user.userProjects.deleteProject(activeProjectId);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const Clicking = (id: number) => {
    toggleIcons(id);
  };

  const buttonsDisabled = () => {
    return !user || !user.userProjects.activeProjectId;
  };

  const statusButtonDisabled = () => {
    return !user;
  };

  return (
    <div
      className={globalClasses.sidebar}
      style={{
        borderRight: `2px solid ${tokens.colorNeutralBackground1Hover}`,
      }}
    >
      <div className={globalClasses.widgetButtonContainer}>
        <Tooltip
          content="Data"
          relationship="label"
          appearance="inverted"
          positioning="after"
          showDelay={0}
          hideDelay={0}
          withArrow={true}
        >
          <Button
            appearance="subtle"
            size="large"
            className={mergeClasses(
              globalClasses.widgetButton,
              openIcons[0] && globalClasses.widgetButtonSelected
            )}
            icon={
              <Cube24Regular
                className={mergeClasses(openIcons[0] && classes.icon)}
              />
            }
            onClick={() => Clicking(0)}
            disabled={buttonsDisabled()}
          />
        </Tooltip>

        <Tooltip
          content="Neural Models"
          relationship="label"
          appearance="inverted"
          positioning="after"
          showDelay={0}
          hideDelay={0}
          withArrow={true}
        >
          <Button
            appearance="subtle"
            size="large"
            className={mergeClasses(
              globalClasses.widgetButton,
              openIcons[1] && globalClasses.widgetButtonSelected
            )}
            icon={
              <BrainCircuit24Regular
                className={mergeClasses(openIcons[1] && classes.icon)}
              />
            }
            onClick={() => Clicking(1)}
            disabled={buttonsDisabled()}
          />
        </Tooltip>

        <Tooltip
          content="Training and Inference"
          relationship="label"
          appearance="inverted"
          positioning="after"
          showDelay={0}
          hideDelay={0}
          withArrow={true}
        >
          <Button
            appearance="subtle"
            size="large"
            className={mergeClasses(
              globalClasses.widgetButton,
              openIcons[2] && globalClasses.widgetButtonSelected
            )}
            icon={
              <Molecule24Regular
                className={mergeClasses(openIcons[2] && classes.icon)}
              />
            }
            onClick={() => Clicking(2)}
            disabled={buttonsDisabled()}
          />
        </Tooltip>

        <Tooltip
          content="Status"
          relationship="label"
          appearance="inverted"
          positioning="after"
          showDelay={0}
          hideDelay={0}
          withArrow={true}
        >
          <Button
            appearance="subtle"
            size="large"
            className={mergeClasses(
              globalClasses.widgetButton,
              openIcons[3] && globalClasses.widgetButtonSelected
            )}
            icon={
              <Status24Regular
                className={mergeClasses(openIcons[3] && classes.icon)}
              />
            }
            onClick={() => Clicking(3)}
            disabled={statusButtonDisabled()}
          />
        </Tooltip>

        <Tooltip
          content="Local Functions"
          relationship="label"
          appearance="inverted"
          positioning="after"
          showDelay={0}
          hideDelay={0}
          withArrow={true}
        >
          <Button
            appearance="subtle"
            size="large"
            className={mergeClasses(
              globalClasses.widgetButton,
              openIcons[4] && globalClasses.widgetButtonSelected
            )}
            icon={
              <DesktopTower24Regular
                className={mergeClasses(openIcons[4] && classes.icon)}
              />
            }
            onClick={() => Clicking(4)}
          />
        </Tooltip>

        <Tooltip
          content="Delete Project"
          relationship="label"
          appearance="inverted"
          positioning="after"
          showDelay={0}
          hideDelay={0}
          withArrow={true}
        >
          <Button
            appearance="subtle"
            size="large"
            className={mergeClasses(globalClasses.widgetButton)}
            style={{ marginTop: "auto", marginBottom: "16px" }}
            icon={<Delete24Regular />}
            onClick={handleDeleteClick}
            disabled={buttonsDisabled()}
          />
        </Tooltip>
      </div>

      {/* Render the DeleteDialog */}
      <DeleteDialog
        TitleText={"Delete Project"}
        BodyText={"Do you really want to delete this project?"}
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
});

export default IconBar;
