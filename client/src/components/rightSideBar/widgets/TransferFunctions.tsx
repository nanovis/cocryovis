import { observer } from "mobx-react-lite";
import globalStyles from "../../globalStyles";
import {
  ArrowCircleRight28Regular,
  ArrowDownload16Regular,
  ArrowUpload16Regular,
  PanelBottomExpandFilled,
  PanelTopExpandFilled,
} from "@fluentui/react-icons";
import type { VisualizedVolumeInstance } from "@/stores/uiState/VisualizedVolume";
import type { VolVisSettingsInstance } from "@/stores/uiState/VolVisSettings";
import {
  Button,
  Tooltip,
  Text,
  tokens,
  makeStyles,
  Field,
  Input,
  ColorArea,
  ColorPicker,
  AlphaSlider,
  ColorSlider,
  SpinButton,
  mergeClasses,
} from "@fluentui/react-components";
import Color from "color";
import TransferFunctionWidget from "@/components/shared/TransferFunctionWidget";
import type {
  TransferFunctionBreakpointInstance,
  TransferFunctionInstance,
} from "@/stores/uiState/TransferFunction";
import { useRef, useState } from "react";
import ToastContainer from "@/utils/toastContainer";
import { getErrorMessage } from "@/utils/helpers";
import { useMst } from "@/stores/RootStore";
import { useScheduler } from "@/hooks/useScheduler";
import DeleteButton from "@/components/shared/DeleteButton";
import {
  TRANSPARENCY_CHECKER_DARK,
  TRANSPARENCY_CHECKER_LIGHT,
} from "@/utils/transparencyChecker";

interface HsvaColor {
  h: number;
  s: number;
  v: number;
  a?: number;
}

interface Props {
  open: boolean;
  close: () => void;
}

const TransferFunctions = observer(({ open, close }: Props) => {
  const globalClasses = globalStyles();
  const { uiState } = useMst();

  return (
    <div
      className={mergeClasses(
        globalClasses.rightSidebar,
        !open && globalClasses.invisible
      )}
      aria-hidden={!open}
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
    const [openSettingsInstanceId, setOpenSettingsInstanceId] = useState<
      string | null
    >(null);
    const [openMarkerId, setOpenMarkerId] = useState<string | null>(null);

    const setOpenMarkerSettings = (
      settingsInstanceId: string | null,
      markerId: string | null
    ) => {
      setOpenSettingsInstanceId(settingsInstanceId);
      setOpenMarkerId(markerId);
    };

    const openSettingsInstance = visualizedVolume.volumeSettings.find(
      (instance) => instance.id === openSettingsInstanceId
    );

    const openMarker = openMarkerId
      ? openSettingsInstance?.transferFunction.breakpoints.get(openMarkerId)
      : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
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
                openMarkerId={openMarkerId}
                setOpenMarkerId={(id) =>
                  setOpenMarkerSettings(settingsInstance.id, id)
                }
              />
            </div>
          )
        )}
        <Text
          style={{
            color: tokens.colorNeutralForeground3,
            marginBottom: "16px",
          }}
        >
          Click on a breakpoint to edit its properties.
          <br />
          Shift or double click on the ramp to add a new breakpoint.
        </Text>
        {openSettingsInstance && openMarker && (
          <TransferFunctionBreakpointEditor
            transferFunction={openSettingsInstance.transferFunction}
            breakpoint={openMarker}
            deleteBreakpoint={(id) =>
              openSettingsInstance.transferFunction.removeBreakpoint(id)
            }
          />
        )}
      </div>
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

const useEditorStyles = makeStyles({
  colorArea: {
    minWidth: "250px",
    minHeight: "125px",
  },
  axis: {
    display: "flex",
    justifyContent: "space-between",
    color: tokens.colorNeutralForeground3,
  },
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
  },
  preview: {
    width: "30px",
    height: "30px",
    borderRadius: "6px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  pickerWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

const toValidInt = (input: number | null | undefined) => {
  if (
    input === null ||
    input === undefined ||
    Number.isNaN(input) ||
    !Number.isInteger(input)
  ) {
    return null;
  }
  return input;
};

const ColorChannelField = ({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) => {
  return (
    <Field label={label} style={{ flex: 1 }}>
      <SpinButton
        value={value}
        min={0}
        max={255}
        onChange={(_event, data) => {
          const val = toValidInt(
            data.value ?? parseInt(data.displayValue ?? "")
          );
          const next = toValidInt(val);
          if (next === null) {
            return;
          }
          onCommit(next);
        }}
      />
    </Field>
  );
};

const TransferFunctionBreakpointEditor = observer(
  ({
    transferFunction,
    breakpoint,
    deleteBreakpoint,
  }: {
    transferFunction: TransferFunctionInstance;
    breakpoint: TransferFunctionBreakpointInstance;
    deleteBreakpoint: (id: string) => void;
  }) => {
    const classes = useEditorStyles();
    const [showColorArea, setShowColorArea] = useState(true);

    const isValidColor = (value: string) => {
      try {
        Color(value).hexa();
        return true;
      } catch {
        return false;
      }
    };

    const commitHexColor = (rawValue: string, inputEl: HTMLInputElement) => {
      if (isValidColor(rawValue)) {
        breakpoint.setColor(rawValue);
        return;
      }
      inputEl.value = breakpoint.color;
    };

    const schedulePositionUpdate = useScheduler<number>((position) => {
      try {
        breakpoint.setPosition(position);
      } catch (error) {
        const toastContainer = new ToastContainer();
        toastContainer.error(getErrorMessage(error));
        console.error("Error:", error);
      }
    });

    const scheduleColorUpdate = useScheduler<HsvaColor>((color) => {
      try {
        breakpoint.setHSV(color.h, color.s, color.v, color.a ?? 1);
      } catch (error) {
        const toastContainer = new ToastContainer();
        toastContainer.error(getErrorMessage(error));
        console.error("Error:", error);
      }
    });

    return (
      <div className={classes.root}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div
              className={classes.preview}
              style={{
                backgroundColor: breakpoint.color,
                backgroundImage: `linear-gradient(${breakpoint.color}, ${breakpoint.color}), ${TRANSPARENCY_CHECKER_LIGHT}, ${TRANSPARENCY_CHECKER_DARK}`,
                backgroundSize: "100% 100%, 8px 8px, 8px 8px",
                backgroundPosition: "0 0, 0 0, 4px 4px",
              }}
            />
            <Field label="Position">
              <Input
                style={{ width: "100px" }}
                step={0.001}
                min={0}
                max={1}
                value={breakpoint.position.toFixed(4)}
                onChange={(event) => {
                  const raw = Number((event.target as HTMLInputElement).value);
                  if (Number.isFinite(raw)) {
                    schedulePositionUpdate(raw);
                  }
                }}
              />
            </Field>
            <Tooltip
              content={
                showColorArea ? "Hide color picker" : "Show color picker"
              }
              relationship="label"
              appearance="inverted"
              positioning="above"
            >
              <Button
                onClick={() => setShowColorArea((prev) => !prev)}
                icon={
                  showColorArea ? (
                    <PanelBottomExpandFilled />
                  ) : (
                    <PanelTopExpandFilled />
                  )
                }
              />
            </Tooltip>
          </div>

          <DeleteButton
            text={"Remove"}
            disabled={!transferFunction.canDeleteBreakpoint}
            onClick={() => deleteBreakpoint(breakpoint.id)}
          />
        </div>

        <div className={classes.pickerWrap}>
          <ColorPicker
            color={breakpoint.hsv}
            onColorChange={(_, data) => {
              scheduleColorUpdate(data.color);
            }}
          >
            {showColorArea ? (
              <ColorArea
                style={{ cursor: "pointer" }}
                className={classes.colorArea}
              />
            ) : null}
            <ColorSlider />
            <AlphaSlider />
          </ColorPicker>
        </div>

        <div style={{ display: "flex", gap: "2px" }}>
          <Field label="Hex">
            <Input
              key={`${breakpoint.id}:${breakpoint.color}`}
              style={{ width: "110px" }}
              defaultValue={breakpoint.color}
              onBlur={(event) => {
                commitHexColor(
                  (event.target as HTMLInputElement).value,
                  event.target as HTMLInputElement
                );
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitHexColor(
                    (event.target as HTMLInputElement).value,
                    event.target as HTMLInputElement
                  );
                }
              }}
            />
          </Field>
          <ColorChannelField
            label={"Red"}
            value={breakpoint.red}
            onCommit={(value) => breakpoint.setRed(value)}
          />
          <ColorChannelField
            label={"Green"}
            value={breakpoint.green}
            onCommit={(value) => breakpoint.setGreen(value)}
          />
          <ColorChannelField
            label={"Blue"}
            value={breakpoint.blue}
            onCommit={(value) => breakpoint.setBlue(value)}
          />
          <ColorChannelField
            label={"Alpha"}
            value={Math.round(breakpoint.alpha * 255)}
            onCommit={(value) => breakpoint.setAlpha(value / 255)}
          />
        </div>
      </div>
    );
  }
);

export default TransferFunctions;
