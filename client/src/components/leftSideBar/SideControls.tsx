import { useState } from "react";

import Volume from "./widgets/Volume";
import Status from "./widgets/Status";
import NanoOtzi from "./widgets/NanoOtzi";
import Models from "./widgets/Models";
import Local from "./widgets/Local";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";
import globalStyles from "../GlobalStyles";
import {
  Button,
  mergeClasses,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import {
  BrainCircuit24Regular,
  Cube24Regular,
  Delete24Regular,
  DesktopTower24Regular,
  Molecule24Regular,
  Status24Regular,
} from "@fluentui/react-icons";
import WidgetToggleButton from "../shared/WidgetToggleButton";
import DeleteDialog from "../shared/DeleteDialog";

const widgets: Array<WidgetDefinition> = [
  {
    title: "Data",
    labelPositioning: "after",
    LabelIcon: Cube24Regular,
    widget: Volume,
  },
  {
    title: "Neural Models",
    labelPositioning: "after",
    LabelIcon: BrainCircuit24Regular,
    widget: Models,
  },
  {
    title: "Training and Inference",
    labelPositioning: "after",
    LabelIcon: Molecule24Regular,
    widget: NanoOtzi,
  },
  {
    title: "Status",
    labelPositioning: "after",
    LabelIcon: Status24Regular,
    widget: Status,
  },
  {
    title: "Local Functions",
    labelPositioning: "after",
    LabelIcon: DesktopTower24Regular,
    widget: Local,
  },
];

const SideControls = observer(() => {
  const globalClasses = globalStyles();

  const { user, uiState } = useMst();
  const activeProjectId = user?.userProjects.activeProjectId;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const buttonDisabled = (id: number) => {
    return !(id === 4 || activeProjectId || (user && id === 3));
  };

  const handleConfirmDelete = async () => {
    try {
      const activeProjectId = user?.userProjects.activeProjectId;
      if (!activeProjectId) {
        return;
      }
      await user.userProjects.deleteProject(activeProjectId);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <>
      <div
        className={globalClasses.sidebar}
        style={{
          borderRight: `2px solid ${tokens.colorNeutralBackground1Hover}`,
        }}
      >
        <div className={globalClasses.widgetButtonContainer}>
          {widgets.map((widget, index) => (
            <WidgetToggleButton
              key={index}
              title={widget.title}
              labelPositioning={widget.labelPositioning}
              LabelIcon={widget.LabelIcon}
              isOpen={uiState.openRightWidget === index}
              onClick={() => uiState.setOpenLeftWidget(index)}
              disabled={buttonDisabled(index)}
            />
          ))}

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
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={!activeProjectId}
            />
          </Tooltip>
        </div>
      </div>
      {widgets.map((widget, index) => (
        <widget.widget
          key={index}
          open={uiState.openLeftWidget === index}
          close={uiState.closeRightHandWidgets}
        />
      ))}

      {/* Render the DeleteDialog */}
      <DeleteDialog
        TitleText={"Delete Project"}
        BodyText={"Do you really want to delete this project?"}
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
});

export default SideControls;
