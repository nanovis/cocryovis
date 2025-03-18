import {
  makeStyles,
  tokens,
  Field,
  Radio,
  RadioGroup,
  Button,
  Label,
  Slider,
  Tooltip,
  Switch,
  Text,
  mergeClasses,
} from "@fluentui/react-components";
import {
  ArrowCircleRight28Regular,
  ArrowDownload16Regular,
  ArrowUpload16Regular,
  EditFilled,
  EraserFilled,
} from "@fluentui/react-icons";
import { useRef, useState } from "react";
import Utils from "../../../functions/Utils";
import { toast } from "react-toastify";
import globalStyles from "../../GlobalStyles";
import { observer } from "mobx-react-lite";
import { useMst } from "../../../stores/RootStore";
import { SparseVolumeSnapshotIn } from "../../../stores/userState/SparseVolumeModel";
import { WriteAccessTooltipContentWrapper } from "../../shared/WriteAccessTooltip";
import { VolVisSettingsInstance } from "../../../stores/uiState/VolVisSettings";
import ShortcutKey from "../../shared/ShortcutKey";

const useStyles = makeStyles({
  uploadSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  Button: {
    "&:hover:enabled": {
      backgroundColor: "#ddff77",
      color: "black",
    },
  },
  transferFunctions: {
    display: "flex",
    alignItems: "flex-start",
    gap: "5px",
  },
  sliderContainer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  colorPicker: {
    marginTop: "0px",
    width: "40px",
    height: "43px",
    border: "none",
    cursor: "pointer",
    background: "none",
    marginRight: "5px",
    padding: 0,
  },
  actionButton: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "5px",
    marginTop: "2px",
    ":hover": {
      cursor: "pointer",
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  clippingPlane: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  volumes: {
    display: "table",
    width: "100%",
  },
  volumesRow: {
    display: "table-row",
    "& > *": {
      display: "table-cell",
      verticalAlign: "middle",
    },
  },
  tfIcon: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    paddingTop: "8px",
    paddingBottom: "8px",
    paddingRight: "8px",
    paddingLeft: "8px",
    borderRadius: "10px",
    ":hover": {
      cursor: "pointer",
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  DrawEraseButton: {},
  DrawEraseButtonToggled: {
    backgroundColor: tokens.colorNeutralBackground1Pressed,
    color: tokens.colorBrandForeground1,
    pointerEvents: "none",
  },
});

interface Props {
  open: boolean;
  close: () => void;
}

const Visualization = observer(({ open, close }: Props) => {
  const { user, uiState } = useMst();

  const activeProject = user?.userProjects.activeProject;
  const visualizedVolume = uiState.visualizedVolume;
  const volVisSettings = visualizedVolume?.volVisSettings;
  const volumeSettings = visualizedVolume?.volumeSettings;
  const volume = visualizedVolume?.volume;

  const classes = useStyles();
  const globalClasses = globalStyles();

  const TFFileRef = useRef<HTMLInputElement | null>(null);

  const [processingSaveAnnotations, setProcessingSaveAnnotations] =
    useState(false);

  const handleSaveAnnotations = async () => {
    if (annotationsActionsDisabled() || volume === undefined) {
      return;
    }

    let toastId = null;
    try {
      toastId = toast.loading("Saving annotations...");
      if (!window.WasmModule) {
        throw new Error("Wasm module not initialized!");
      }
      if (!visualizedVolume?.canEditLabels) {
        throw new Error("Only raw volumes can be labeled.");
      }

      setProcessingSaveAnnotations(true);
      const annotations = window.WasmModule?.get_annotations();

      const annotationsFile = new Blob([annotations], {
        type: "application/json",
      });
      const formData = new FormData();
      formData.append("file", annotationsFile);

      if (
        visualizedVolume.manualLabelIndex >= volume.sparseVolumeArray.length
      ) {
        let response = await Utils.sendReq(
          `volume/${volume.id}/add-annotations`,
          {
            method: "PUT",
            credentials: "include",
            body: formData,
          },
          false
        );

        let sparseLabel: SparseVolumeSnapshotIn = await response.json();

        response = await Utils.sendReq(
          `/volumeData/SparseLabeledVolumeData/${sparseLabel.id}`,
          {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              color:
                volume.sparseLabelColors[visualizedVolume.manualLabelIndex],
            }),
          },
          false
        );

        sparseLabel = await response.json();

        volume.addSparseVolume(sparseLabel);
      } else {
        const sparseLabelVolume =
          volume.sparseVolumeArray[visualizedVolume.manualLabelIndex];
        await Utils.sendReq(
          `volume/${volume.id}/volumeData/SparseLabeledVolumeData/${sparseLabelVolume.id}/update-annotations`,
          {
            method: "PUT",
            credentials: "include",
            body: formData,
          }
        );
      }

      toast.update(toastId, {
        render: "Annotations saved.",
        type: "success",
        isLoading: false,
        autoClose: 2000,
      });
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error("Error:", error);
    } finally {
      setProcessingSaveAnnotations(false);
    }
  };

  const handleResetAnnotations = () => {
    if (annotationsActionsDisabled()) {
      return;
    }

    window.WasmModule?.reset_annotations();
  };

  const handleChangeTFColor = (
    event: React.ChangeEvent<HTMLInputElement>,
    volVisSettings: VolVisSettingsInstance
  ) => {
    const color = Utils.fromHexColor(event.target.value);
    volVisSettings.transferFunction.setColor(color.r, color.g, color.b);
  };

  const downloadTF = async (volVisSettings: VolVisSettingsInstance) => {
    const transferFunction = volVisSettings.transferFunction;
    if (!transferFunction) {
      return;
    }

    const blob = new Blob(
      [
        JSON.stringify(
          {
            rampLow: transferFunction.rampLow,
            rampHigh: transferFunction.rampHigh,
            color: {
              x: transferFunction.red,
              y: transferFunction.green,
              z: transferFunction.blue,
            },
            comment: `tf-${volVisSettings.index}`,
          },
          null,
          2
        ),
      ],
      {
        type: "text/plain",
      }
    );

    Utils.downloadBlob(blob, `transferFunction_${volVisSettings.index}.json`);
  };

  const handleTFUpload = async (
    event: FileChangeEvent,
    volVisSettings: VolVisSettingsInstance
  ) => {
    try {
      await volVisSettings.transferFunction?.handleTFUpload(event.target.files);
    } catch (error) {
      toast.error(`Error: ${error}`);
      console.error("Error:", error);
    } finally {
      if (TFFileRef.current) {
        TFFileRef.current.value = "";
      }
    }
  };

  const handleVisibilityChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    volVisSettings: VolVisSettingsInstance
  ) => {
    volVisSettings.setVisibility(event.target.checked);
  };

  const handleClippingChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    volumeSettings: VolVisSettingsInstance
  ) => {
    volumeSettings.setClipping(event.target.checked);
  };

  const handleChangeRW = (
    event: React.ChangeEvent<HTMLInputElement>,
    upper: boolean
  ) => {
    if (!visualizedVolume?.rawSettings) {
      return;
    }

    if (!upper) {
      visualizedVolume?.rawSettings.transferFunction.setRampLow(
        Number(event.target.value)
      );
    } else {
      visualizedVolume?.rawSettings.transferFunction.setRampHigh(
        Number(event.target.value)
      );
    }
  };

  const handleChangeShadows = (
    event: React.ChangeEvent<HTMLInputElement>,
    upper: boolean
  ) => {
    if (!visualizedVolume?.shadowsSettings) {
      return;
    }

    if (!upper) {
      visualizedVolume.shadowsSettings.transferFunction.setRampLow(
        Number(event.target.value)
      );
    } else {
      visualizedVolume.shadowsSettings.transferFunction.setRampHigh(
        Number(event.target.value)
      );
    }
  };

  const actionsDisabled = () => {
    return !uiState.visualizedVolume;
  };

  const annotationsActionsDisabled = () => {
    return (
      actionsDisabled() ||
      processingSaveAnnotations ||
      !visualizedVolume?.canEditLabels ||
      !visualizedVolume?.labelEditingMode
    );
  };

  return open ? (
    <div className={globalClasses.rightSidebar}>
      <div className={globalClasses.sidebarContents}>
        <div className={globalClasses.sidebarHeader}>
          <h1>Visualization</h1>
          <div
            onClick={close}
            className={globalClasses.closeSidebarIconContainer}
          >
            <ArrowCircleRight28Regular
              className={globalClasses.closeSidebarIcon}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            justifyItems: "center",
            width: "100%",
            margin: "auto",
            paddingTop: "4px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-around",
            }}
          >
            <Tooltip
              content={
                <WriteAccessTooltipContentWrapper
                  content={
                    visualizedVolume?.manualLabelIndex
                      ? `Saves annotations into Manual Label ${visualizedVolume?.manualLabelIndex}.`
                      : "Saves annotations into selected manual label."
                  }
                  hasWriteAccess={
                    annotationsActionsDisabled() ||
                    activeProject?.hasWriteAccess
                  }
                />
              }
              relationship={"label"}
            >
              <Button
                onClick={handleSaveAnnotations}
                className={classes.Button}
                disabled={
                  annotationsActionsDisabled() || !activeProject?.hasWriteAccess
                }
              >
                Save Annotation
              </Button>
            </Tooltip>

            <Button
              onClick={handleResetAnnotations}
              className={classes.Button}
              disabled={annotationsActionsDisabled()}
            >
              Reset Annotations
            </Button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Field label="Annotation Mode">
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  width: "80px",
                  justifyContent: "space-between",
                  marginTop: "5px",
                  marginLeft: "14px",
                }}
              >
                <Tooltip
                  content={
                    <Text>
                      Draw Annorations <ShortcutKey content="L" />
                    </Text>
                  }
                  relationship={"label"}
                  positioning="before"
                  appearance="inverted"
                >
                  <Button
                    className={mergeClasses(
                      classes.DrawEraseButton,
                      visualizedVolume &&
                        !visualizedVolume.eraseMode &&
                        classes.DrawEraseButtonToggled
                    )}
                    disabled={annotationsActionsDisabled()}
                    icon={<EditFilled />}
                    appearance="outline"
                    onClick={() => {
                      visualizedVolume?.setEraseMode(false);
                    }}
                  />
                </Tooltip>
                <Tooltip
                  content={
                    <Text>
                      Erase Annorations <ShortcutKey content="L" />
                    </Text>
                  }
                  relationship="label"
                  positioning="after"
                  appearance="inverted"
                >
                  <Button
                    disabled={annotationsActionsDisabled()}
                    className={mergeClasses(
                      classes.DrawEraseButton,
                      visualizedVolume &&
                        visualizedVolume.eraseMode &&
                        classes.DrawEraseButtonToggled
                    )}
                    icon={<EraserFilled />}
                    appearance="outline"
                    onClick={() => {
                      visualizedVolume?.setEraseMode(true);
                    }}
                    style={{ marginLeft: "5px" }}
                  />
                </Tooltip>
              </div>
            </Field>
            <Field label={`Kernel Size [${uiState.kernelSize}]`}>
              <Slider
                style={{ width: "200px" }}
                disabled={annotationsActionsDisabled()}
                value={uiState.kernelSize}
                min={1}
                max={200}
                onChange={(_, data) =>
                  uiState.setKernelSize(Number(data.value))
                }
              />
            </Field>
          </div>

          {/* Set Clipping Plane */}
          <Field label="Clipping Plane">
            <RadioGroup
              value={visualizedVolume?.clippingPlane ?? "0"}
              onChange={(_, data) => {
                visualizedVolume?.setClippingPlane(
                  data.value as "0" | "1" | "2" | "3" | "4"
                );
              }}
              className={classes.clippingPlane}
              disabled={actionsDisabled()}
            >
              <Radio value="0" label="None" />
              <Radio value="1" label="View-aligned" />
              <Radio value="2" label="YZ-plane" />
              <Radio value="3" label="XZ-plane" />
              <Radio value="4" label="XY-plane" />
            </RadioGroup>
          </Field>

          <Tooltip
            content={
              <Text>
                Shows raw volume when any clipping plane is enabled{" "}
                <ShortcutKey content="R" />
              </Text>
            }
            relationship="description"
            appearance="inverted"
            positioning="after"
          >
            <Label style={{ display: "flex", alignItems: "center" }}>
              Show Raw Clipping Plane
              <Switch
                labelPosition="before"
                style={{ marginLeft: 10 }}
                disabled={
                  actionsDisabled() ||
                  visualizedVolume?.rawSettings === undefined
                }
                checked={
                  visualizedVolume?.rawSettings !== undefined &&
                  (visualizedVolume?.showRawClippingPlane ?? false)
                }
                min={1}
                max={200}
                onChange={(_, data) =>
                  visualizedVolume?.setShowRawClippingPlane(data.checked)
                }
              />
            </Label>
          </Tooltip>

          <Tooltip
            content={
              <Text>
                Toggle fullscreen mode <ShortcutKey content="F" />
              </Text>
            }
            relationship="description"
            appearance="inverted"
            positioning="after"
          >
            <Label style={{ display: "flex", alignItems: "center" }}>
              Fullscreen
              <Switch
                labelPosition="before"
                style={{ marginLeft: 105 }}
                disabled={
                  actionsDisabled() || visualizedVolume?.clippingPlane === "0"
                }
                checked={visualizedVolume?.fullscreen ?? false}
                min={1}
                max={200}
                onChange={(_, data) =>
                  visualizedVolume?.setFullscreen(data.checked)
                }
              />
            </Label>
          </Tooltip>

          <hr
            style={{
              margin: "12px 0",
              border: "1px solid",
              borderColor: tokens.colorNeutralBackground1Hover,
            }}
          />
          <h3 style={{ fontWeight: "100", margin: 0 }}>Volumes(s)</h3>
          {volVisSettings && (
            <>
              <div className={classes.volumes}>
                <div className={classes.volumesRow}>
                  <h5>Name</h5>
                  <h5>Visible</h5>
                  <h5>Clipping</h5>
                </div>
                {volumeSettings?.map(
                  (settingsInstance: VolVisSettingsInstance, index: number) => (
                    <div key={index} className={classes.volumesRow}>
                      <span>{settingsInstance.name.substring(0, 40)}</span>
                      <Switch
                        checked={settingsInstance.visible}
                        onChange={(event) =>
                          handleVisibilityChange(event, settingsInstance)
                        }
                      />
                      <Switch
                        checked={settingsInstance.clipping}
                        onChange={(event) =>
                          handleClippingChange(event, settingsInstance)
                        }
                      />
                    </div>
                  )
                )}
                {visualizedVolume.rawSettings && (
                  <>
                    <div
                      className={classes.volumesRow}
                      style={{ height: "13px" }}
                    />
                    <div className={classes.volumesRow}>
                      <Label style={{ verticalAlign: "top" }}>
                        Raw Volume Contribution
                      </Label>
                      <div className={classes.sliderContainer}>
                        <Label>Min value</Label>
                        <Slider
                          value={
                            visualizedVolume.rawSettings.transferFunction
                              .rampLow * 100
                          }
                          min={0}
                          max={100}
                          onChange={(event) => handleChangeRW(event, false)}
                        />
                      </div>
                      <div className={classes.sliderContainer}>
                        <Label>Max value</Label>
                        <Slider
                          value={
                            visualizedVolume.rawSettings.transferFunction
                              .rampHigh * 100
                          }
                          min={0}
                          max={100}
                          onChange={(event) => handleChangeRW(event, true)}
                        />
                      </div>
                    </div>
                  </>
                )}
                {visualizedVolume.shadowsSettings && (
                  <>
                    <div
                      className={classes.volumesRow}
                      style={{ height: "5px" }}
                    />
                    <div className={classes.volumesRow}>
                      <Label style={{ verticalAlign: "top" }}>
                        Soft Shadows Parameters
                      </Label>
                      <div className={classes.sliderContainer}>
                        <Label>Min value</Label>
                        <Slider
                          value={
                            visualizedVolume.shadowsSettings.transferFunction
                              .rampLow * 100
                          }
                          min={0}
                          max={100}
                          onChange={(event) =>
                            handleChangeShadows(event, false)
                          }
                        />
                      </div>
                      <div className={classes.sliderContainer}>
                        <Label>Max value</Label>
                        <Slider
                          value={
                            visualizedVolume.shadowsSettings.transferFunction
                              .rampHigh * 100
                          }
                          min={0}
                          max={100}
                          onChange={(event) => handleChangeShadows(event, true)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <hr
                style={{
                  margin: "12px 0",
                  border: "1px solid",
                  borderColor: tokens.colorNeutralBackground1Hover,
                }}
              />

              <h3 style={{ fontWeight: "100", margin: 0 }}>
                Transfer Function(s)
              </h3>

              {volumeSettings?.map(
                (settingsInstance: VolVisSettingsInstance, index: number) => (
                  <div key={index} className={classes.transferFunctions}>
                    <input
                      className={classes.colorPicker}
                      type="color"
                      value={Utils.toHexColor(
                        settingsInstance.transferFunction.red,
                        settingsInstance.transferFunction.green,
                        settingsInstance.transferFunction.blue
                      )}
                      onChange={(event) =>
                        handleChangeTFColor(event, settingsInstance)
                      }
                    />
                    <div className={classes.sliderContainer}>
                      <Label>Low bound</Label>
                      <Slider
                        value={settingsInstance.transferFunction.rampLow * 100}
                        min={0}
                        max={100}
                        onChange={(_, data) =>
                          settingsInstance.transferFunction.setRampLow(
                            Number(data.value)
                          )
                        }
                      />
                    </div>
                    <div className={classes.sliderContainer}>
                      <Label>High bound</Label>
                      <Slider
                        value={settingsInstance.transferFunction.rampHigh * 100}
                        min={0}
                        max={100}
                        onChange={(_, data) =>
                          settingsInstance.transferFunction.setRampHigh(
                            Number(data.value)
                          )
                        }
                      />
                    </div>

                    <div
                      onClick={() => downloadTF(settingsInstance)}
                      className={classes.actionButton}
                    >
                      <Tooltip
                        content="Download Transfer Function"
                        relationship="label"
                        appearance="inverted"
                        positioning="after-top"
                      >
                        <ArrowDownload16Regular
                          className={classes.tfIcon}
                          style={{
                            marginTop: "3px",
                            border: "1px solid",
                            borderRadius: "5px",
                            padding: 8,
                          }}
                        />
                      </Tooltip>
                    </div>
                    <div
                      onClick={() => TFFileRef.current?.click()}
                      className={classes.actionButton}
                    >
                      <Tooltip
                        content="Upload Transfer Function"
                        relationship="label"
                        appearance="inverted"
                        positioning="after-top"
                      >
                        <ArrowUpload16Regular
                          className={classes.tfIcon}
                          style={{
                            marginTop: "3px",
                            border: "1px solid",
                            borderRadius: "5px",
                            padding: 8,
                          }}
                        />
                      </Tooltip>
                      <input
                        type="file"
                        onChange={(event) =>
                          handleTFUpload(event, settingsInstance)
                        }
                        accept=".json"
                        ref={TFFileRef}
                        className={globalClasses.hiddenInput}
                      />
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;
});

export default Visualization;
