import Visualization from "./widgets/Visualization";
import RenderSettings from "./widgets/RenderSettings";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";
import globalStyles from "../GlobalStyles";
import { Button, tokens, Tooltip } from "@fluentui/react-components";
import WidgetToggleButton from "../shared/WidgetToggleButton";
import {
  ArrowUpload24Regular,
  BorderNone24Regular,
  Info24Regular,
  SlideSettings24Regular,
} from "@fluentui/react-icons";
import { useState } from "react";
import * as Utils from "../../utils/Helpers";
import About from "./widgets/About";
import VolumeUploadDialog from "../shared/VolumeUploadDialog";
import { VolumeData, VolumeDescriptor } from "../../utils/volumeSettings";
import ToastContainer from "../../utils/ToastContainer";
import { convertMRCToRaw } from "../../utils/MrcParser";
import type { VisualizationDescriptor } from "../../renderer/volume/volumeManager";

const enum WidgetIndices {
  Visualization = 0,
  RenderSettings = 1,
  About = 2,
}

const SideControls = observer(() => {
  const { uiState, pageDisabled } = useMst();
  const globalClasses = globalStyles();

  const [isVisDialogOpen, setIsVisDialogOpen] = useState(false);

  const visualizeVolume = async (volumeDescriptor: VolumeDescriptor) => {
    const toastContainer = new ToastContainer();

    try {
      toastContainer.loading("Parsing volume files...");

      let descriptor = volumeDescriptor;

      if (
        descriptor.volumeData.file &&
        Utils.isMrcFile(descriptor.volumeData.file.name)
      ) {
        const { rawFile, settings } = await convertMRCToRaw(
          descriptor.volumeData.file
        );
        descriptor = new VolumeDescriptor(
          new VolumeData({ file: rawFile }),
          settings
        );
      }

      const visualizationDescriptor: VisualizationDescriptor = {
        descriptors: [descriptor],
      };

      toastContainer.loading("Visualizing the volume...");

      await uiState.visualizeVolume(visualizationDescriptor);
      toastContainer.success("Visualization Ready!");
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      throw error;
    }
  };

  return (
    <>
      <div
        className={globalClasses.sidebar}
        style={{
          borderLeft: `2px solid ${tokens.colorNeutralBackground1Hover}`,
        }}
      >
        <div className={globalClasses.widgetButtonContainer}>
          <Tooltip
            content="Visualize Local Volume"
            relationship="label"
            appearance="inverted"
            positioning="before"
            showDelay={0}
            hideDelay={0}
            withArrow={true}
          >
            <Button
              appearance="subtle"
              size="large"
              className={globalClasses.widgetButton}
              icon={<ArrowUpload24Regular />}
              onClick={() => setIsVisDialogOpen(true)}
              disabled={pageDisabled}
            />
          </Tooltip>

          <WidgetToggleButton
            title={"Visualization"}
            labelPositioning={"before"}
            LabelIcon={BorderNone24Regular}
            isOpen={
              uiState.openRightWidget ===
              (WidgetIndices.Visualization as number)
            }
            onClick={() =>
              uiState.setOpenRightWidget(WidgetIndices.Visualization)
            }
            disabled={!uiState.visualizedVolume || pageDisabled}
          />

          <WidgetToggleButton
            title={"Render Settings"}
            labelPositioning={"before"}
            LabelIcon={SlideSettings24Regular}
            isOpen={
              uiState.openRightWidget ===
              (WidgetIndices.RenderSettings as number)
            }
            onClick={() =>
              uiState.setOpenRightWidget(WidgetIndices.RenderSettings)
            }
            disabled={pageDisabled}
          />

          <WidgetToggleButton
            title={"About"}
            labelPositioning={"before"}
            LabelIcon={Info24Regular}
            isOpen={uiState.openRightWidget === (WidgetIndices.About as number)}
            onClick={() => uiState.setOpenRightWidget(WidgetIndices.About)}
            disabled={pageDisabled}
          />
        </div>
      </div>

      <Visualization
        open={
          uiState.openRightWidget === (WidgetIndices.Visualization as number)
        }
        close={uiState.closeRightHandWidgets}
      />

      <RenderSettings
        open={
          uiState.openRightWidget === (WidgetIndices.RenderSettings as number)
        }
        close={uiState.closeRightHandWidgets}
      />

      <About
        open={uiState.openRightWidget === (WidgetIndices.About as number)}
        close={uiState.closeRightHandWidgets}
      />

      <VolumeUploadDialog
        open={isVisDialogOpen}
        onClose={() => setIsVisDialogOpen(false)}
        onConfirm={visualizeVolume}
        titleText={"Visualize Volume"}
        confirmText="Visualize"
        uploadDialogStore={uiState.uploadDialog}
      />
    </>
  );
});

export default SideControls;
