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
  Toolbox24Regular,
} from "@fluentui/react-icons";
import WidgetToggleButton from "../shared/WidgetToggleButton";
import DeleteDialog from "../shared/DeleteDialog";
import CryoTools from "./widgets/CryoTools";

const enum WidgetIndices {
  Volume = 0,
  Models = 1,
  NanoOtzi = 2,
  Status = 3,
  Local = 4,
  PreProcessing = 5,
}

const SideControls = observer(() => {
  const globalClasses = globalStyles();

  const { user, uiState } = useMst();
  const activeProjectId = user?.userProjects.activeProjectId;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
          <WidgetToggleButton
            title={"Data"}
            labelPositioning={"after"}
            LabelIcon={Cube24Regular}
            isOpen={uiState.openLeftWidget === WidgetIndices.Volume}
            onClick={() => uiState.setOpenLeftWidget(WidgetIndices.Volume)}
            disabled={activeProjectId === undefined}
          />

          <WidgetToggleButton
            title={"Neural Models"}
            labelPositioning={"after"}
            LabelIcon={BrainCircuit24Regular}
            isOpen={uiState.openLeftWidget === WidgetIndices.Models}
            onClick={() => uiState.setOpenLeftWidget(WidgetIndices.Models)}
            disabled={activeProjectId === undefined}
          />

          <WidgetToggleButton
            title={"Training and Inference"}
            labelPositioning={"after"}
            LabelIcon={Cube24Regular}
            isOpen={uiState.openLeftWidget === WidgetIndices.NanoOtzi}
            onClick={() => uiState.setOpenLeftWidget(WidgetIndices.NanoOtzi)}
            disabled={activeProjectId === undefined}
          />

          <WidgetToggleButton
            title={"Status"}
            labelPositioning={"after"}
            LabelIcon={Status24Regular}
            isOpen={uiState.openLeftWidget === WidgetIndices.Status}
            onClick={() => uiState.setOpenLeftWidget(WidgetIndices.Status)}
            disabled={user === undefined}
          />

          <WidgetToggleButton
            title={"Data"}
            labelPositioning={"after"}
            LabelIcon={DesktopTower24Regular}
            isOpen={uiState.openLeftWidget === WidgetIndices.Local}
            onClick={() => uiState.setOpenLeftWidget(WidgetIndices.Local)}
          />

          <WidgetToggleButton
            title={"PreProcessing"}
            labelPositioning={"after"}
            LabelIcon={Toolbox24Regular}
            isOpen={uiState.openLeftWidget === WidgetIndices.PreProcessing}
            onClick={() => uiState.setOpenLeftWidget(WidgetIndices.PreProcessing)}
          />

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

      <Volume
        open={uiState.openLeftWidget === WidgetIndices.Volume}
        close={uiState.closeLeftHandWidgets}
      />
      <Models
        open={uiState.openLeftWidget === WidgetIndices.Models}
        close={uiState.closeLeftHandWidgets}
      />
      <NanoOtzi
        open={uiState.openLeftWidget === WidgetIndices.NanoOtzi}
        close={uiState.closeLeftHandWidgets}
      />
      <Status
        open={uiState.openLeftWidget === WidgetIndices.Status}
        close={uiState.closeLeftHandWidgets}
      />
      <Local
        open={uiState.openLeftWidget === WidgetIndices.Local}
        close={uiState.closeLeftHandWidgets}
      />
      <CryoTools
        open={uiState.openLeftWidget === WidgetIndices.PreProcessing}
        close={uiState.closeLeftHandWidgets}
      />

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
