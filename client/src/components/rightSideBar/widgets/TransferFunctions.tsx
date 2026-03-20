import { observer } from "mobx-react-lite";
import globalStyles from "../../globalStyles";
import {
  ArrowCircleRight28Regular,
  ArrowDownload16Regular,
  ArrowUpload16Regular,
} from "@fluentui/react-icons";
import type { VisualizedVolumeInstance } from "@/stores/uiState/VisualizedVolume";
import type { VolVisSettingsInstance } from "@/stores/uiState/VolVisSettings";
import { Button, Tooltip, Text, tokens } from "@fluentui/react-components";
import TransferFunctionWidget from "@/components/shared/TransferFunctionWidget";
import type { TransferFunctionInstance } from "@/stores/uiState/TransferFunction";
import { useRef } from "react";
import ToastContainer from "@/utils/toastContainer";
import { getErrorMessage } from "@/utils/helpers";
import { useMst } from "@/stores/RootStore";

interface Props {
  open: boolean;
  close: () => void;
}

const TransferFunctions = observer(({ open, close }: Props) => {
  const globalClasses = globalStyles();
  const { uiState } = useMst();

  return (
    <div
      style={{ display: open ? "block" : "none" }}
      className={globalClasses.rightSidebar}
    >
      <div className={globalClasses.sidebarContents}>
        <div className={globalClasses.sidebarHeader}>
          <h1>Transfer Functions</h1>
          <div
            onClick={close}
            className={globalClasses.closeSidebarIconContainer}
          >
            <ArrowCircleRight28Regular
              className={globalClasses.closeSidebarIcon}
            />
          </div>
        </div>
        <div className={globalClasses.siderbarBody}>
          {uiState.visualizedVolume ? (
            <TransferFunctionList visualizedVolume={uiState.visualizedVolume} />
          ) : (
            <Text style={{ color: tokens.colorNeutralForeground3 }}>
              No volume visualized. Please visualize a volume to edit transfer
              functions.
            </Text>
          )}
        </div>
      </div>
    </div>
  );
});

const TransferFunctionList = observer(
  ({ visualizedVolume }: { visualizedVolume: VisualizedVolumeInstance }) => {
    return (
      <>
        {visualizedVolume.volumeSettings.map(
          (settingsInstance: VolVisSettingsInstance) => (
            <div
              key={settingsInstance.id}
              style={{
                display: "grid",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{settingsInstance.name.substring(0, 40)}</span>
                <div
                  style={{ display: "flex", flexDirection: "row", gap: "8px" }}
                >
                  <TransferFunctionUpload
                    transferFunction={settingsInstance.transferFunction}
                  />
                  <Tooltip
                    content="Download Transfer Function"
                    relationship="label"
                    appearance="inverted"
                    positioning="above"
                  >
                    <Button
                      onClick={() =>
                        settingsInstance.transferFunction.download()
                      }
                      icon={<ArrowDownload16Regular />}
                    />
                  </Tooltip>
                </div>
              </div>

              <TransferFunctionWidget
                transferFunction={settingsInstance.transferFunction}
              />
            </div>
          )
        )}
      </>
    );
  }
);

const TransferFunctionUpload = ({
  transferFunction,
}: {
  transferFunction: TransferFunctionInstance;
}) => {
  const globalClasses = globalStyles();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleTFUpload = async (event: FileChangeEvent) => {
    try {
      const file = event.target.files?.[0];
      if (!file) {
        throw new Error("No file selected.");
      }
      const text = await file.text();
      transferFunction.fromJsonString(text);
    } catch (error) {
      const toastContainer = new ToastContainer();
      toastContainer.error(getErrorMessage(error));
      console.error("Error:", error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <Tooltip
        content="Upload Transfer Function"
        relationship="label"
        appearance="inverted"
        positioning="above"
      >
        <Button
          onClick={() => fileInputRef.current?.click()}
          icon={<ArrowUpload16Regular />}
        />
      </Tooltip>
      <input
        type="file"
        onChange={(event) => void handleTFUpload(event)}
        accept=".json"
        ref={fileInputRef}
        className={globalClasses.hiddenInput}
      />
    </>
  );
};

export default TransferFunctions;
