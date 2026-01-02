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
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import * as Utils from "../../../utils/helpers";
import globalStyles from "../../globalStyles";
import { observer } from "mobx-react-lite";
import { useMst } from "@/stores/RootStore";
import { WriteAccessTooltipContentWrapper } from "../../shared/WriteAccessTooltip";
import type { VolVisSettingsInstance } from "@/stores/uiState/VolVisSettings";
import ShortcutKey from "../../shared/ShortcutKey";
import {
  createFromFiles,
  updateAnnotations,
  updateVolumeData,
} from "@/api/volumeData";
import ToastContainer from "../../../utils/toastContainer";
import type { ClippingPlaneType } from "@/renderer/volume/clippingPlaneManager";

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
    width: "100%",
    display: "grid",
    gridTemplateColumns: "auto auto",
    alignItems: "center",
  },
  volumesRow: {
    display: "contents",
  },
  volumesHeader: {
    marginBottom: "8px",
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    alignItems: "center",
  },
  settingsGridRow: {
    display: "contents",
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
  const { user, uiState, renderer } = useMst();

  const activeProject = user.userProjects.activeProject;
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

    const toastContainer = new ToastContainer();
    try {
      toastContainer.loading("Saving annotations...");
      if (!renderer) {
        throw new Error("Renderer not initialized!");
      }
      if (!visualizedVolume?.canEditLabels) {
        throw new Error("Only raw volumes can be labeled.");
      }

      setProcessingSaveAnnotations(true);
      const annotationData = await renderer.annotationManager.exportAnnotation(
        visualizedVolume.manualLabelIndex
      );

      if (!annotationData) {
        throw new Error("No annotations to save.");
      }

      if (
        visualizedVolume.manualLabelIndex >= volume.sparseVolumeArray.length
      ) {
        // let sparseLabel = await addAnnotations(volume.id, annotationData);
        if (!volume.rawData) {
          throw new Error("Volume missing raw data.");
        }
        const filename = `volume-channel-${visualizedVolume.manualLabelIndex}.raw`;
        let sparseLabel = await createFromFiles(
          "SparseLabeledVolumeData",
          volume.id,
          {
            rawFile: new File([annotationData], filename, {
              type: "application/octet-stream",
            }),
            volumeSettings: {
              file: filename,
              size: {
                x: volume.rawData.sizeX,
                y: volume.rawData.sizeY,
                z: volume.rawData.sizeZ,
              },
              ratio: {
                x: volume.rawData.ratioX,
                y: volume.rawData.ratioY,
                z: volume.rawData.ratioZ,
              },
              bytesPerVoxel: 1,
              usedBits: 8,
              isLittleEndian: true,
            },
          }
        );

        sparseLabel = await updateVolumeData(
          "SparseLabeledVolumeData",
          sparseLabel.id,
          { color: volume.sparseLabelColors[visualizedVolume.manualLabelIndex] }
        );

        volume.addSparseVolume(sparseLabel);
      } else {
        const sparseLabelVolume =
          volume.sparseVolumeArray[visualizedVolume.manualLabelIndex];

        const rawFile = new File(
          [annotationData],
          `volume-channel-${visualizedVolume.manualLabelIndex}.raw`,
          {
            type: "application/octet-stream",
          }
        );

        await updateAnnotations(volume.id, sparseLabelVolume.id, {
          rawFile: rawFile,
        });
      }
      toastContainer.success("Annotations saved.");
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      console.error("Error:", error);
    } finally {
      setProcessingSaveAnnotations(false);
    }
  };

  const handleClearAnnotations = () => {
    if (annotationsActionsDisabled()) {
      return;
    }

    visualizedVolume?.clearActiveAnnotationChannel();
  };

  const downloadTF = (volVisSettings: VolVisSettingsInstance) => {
    const transferFunction = volVisSettings.transferFunction;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("No file selected.");
      }
      await volVisSettings.transferFunction.handleTFUpload(
        event.target.files[0]
      );
    } catch (error) {
      const toastContainer = new ToastContainer();
      toastContainer.error(`Error: ${error}`);
      console.error("Error:", error);
    } finally {
      if (TFFileRef.current) {
        TFFileRef.current.value = "";
      }
    }
  };

  // const handleClippingChange = (
  //   event: ChangeEvent<HTMLInputElement>,
  //   volumeSettings: VolVisSettingsInstance
  // ) => {
  //   volumeSettings.setClipping(event.target.checked);
  // };

  const handleChangeRW = (
    event: ChangeEvent<HTMLInputElement>,
    upper: boolean
  ) => {
    if (!visualizedVolume?.rawSettings) {
      return;
    }

    if (!upper) {
      visualizedVolume.rawSettings.transferFunction.setRampLow(
        Number(event.target.value)
      );
    } else {
      visualizedVolume.rawSettings.transferFunction.setRampHigh(
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
      !visualizedVolume.labelEditingMode
    );
  };

  const TFUploadElement = ({
    settingsInstance,
  }: {
    settingsInstance: VolVisSettingsInstance;
  }) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    return (
      <div
        onClick={() => fileInputRef.current?.click()}
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
          onChange={(event) => handleTFUpload(event, settingsInstance)}
          accept=".json"
          ref={fileInputRef}
          className={globalClasses.hiddenInput}
        />
      </div>
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
                      ? `Saves annotations into Manual Label ${visualizedVolume.manualLabelIndex}.`
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
              onClick={handleClearAnnotations}
              className={classes.Button}
              disabled={annotationsActionsDisabled()}
            >
              Clear Annotation
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
                      Erase Annotations <ShortcutKey content="L" />
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
                onChange={(_, data) => uiState.setKernelSize(data.value)}
              />
            </Field>
          </div>
          {/* Set Clipping Plane */}
          <Field label="Clipping Plane">
            <RadioGroup
              value={visualizedVolume?.clippingPlane ?? "none"}
              onChange={(_, data) => {
                visualizedVolume?.setClippingPlane(
                  data.value as ClippingPlaneType
                );
              }}
              className={classes.clippingPlane}
              disabled={actionsDisabled()}
            >
              <Radio value="none" label="None" />
              <Radio value="view-aligned" label="View-aligned" />
              <Radio value="x" label="YZ-plane" />
              <Radio value="y" label="XZ-plane" />
              <Radio value="z" label="XY-plane" />
            </RadioGroup>
          </Field>

          <div className={classes.settingsGrid}>
            <div className={classes.settingsGridRow}>
              <Text>
                Clipping Plane Offset [
                {visualizedVolume?.clippingPlaneOffset.toFixed(2)}]
              </Text>
              <Slider
                disabled={
                  actionsDisabled() ||
                  visualizedVolume?.clippingPlane === "none"
                }
                value={
                  visualizedVolume?.clippingPlaneOffset
                    ? visualizedVolume.clippingPlaneOffset * 100
                    : 0
                }
                min={-100}
                max={100}
                onChange={(_, data) =>
                  visualizedVolume?.setClippingOffset(data.value / 100)
                }
              />
            </div>
            <Tooltip
              content={
                <Text>
                  Shows raw volume when any clipping plane is enabled
                  <ShortcutKey content="R" />
                </Text>
              }
              relationship="description"
              appearance="inverted"
              positioning="after"
            >
              <div className={classes.settingsGridRow}>
                <Text>Show Raw Clipping Plane</Text>
                <Switch
                  disabled={
                    actionsDisabled() ||
                    visualizedVolume?.rawSettings === undefined ||
                    visualizedVolume.clippingPlane === "none"
                  }
                  checked={
                    visualizedVolume?.rawSettings !== undefined &&
                    visualizedVolume.showRawClippingPlane
                  }
                  min={1}
                  max={200}
                  onChange={(_, data) =>
                    visualizedVolume?.setShowRawClippingPlane(data.checked)
                  }
                />
              </div>
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
              <div className={classes.settingsGridRow}>
                <Text>Fullscreen</Text>
                <Switch
                  disabled={
                    actionsDisabled() ||
                    visualizedVolume?.clippingPlane === "none"
                  }
                  checked={visualizedVolume?.fullscreen ?? false}
                  min={1}
                  max={200}
                  onChange={(_, data) =>
                    visualizedVolume?.setFullscreen(data.checked)
                  }
                />
              </div>
            </Tooltip>
          </div>

          <hr
            style={{
              margin: "12px 0",
              border: "1px solid",
              borderColor: tokens.colorNeutralBackground1Hover,
            }}
          />
          <h3 style={{ fontWeight: "100", margin: 0 }}>Volume(s)</h3>
          {volVisSettings && (
            <>
              <div className={classes.volumes}>
                <Text className={classes.volumesHeader} weight="semibold">
                  Name
                </Text>
                <Text className={classes.volumesHeader} weight="semibold">
                  Visible
                </Text>
                {volumeSettings?.map(
                  (settingsInstance: VolVisSettingsInstance, index: number) => (
                    <div key={index} className={classes.volumesRow}>
                      <span>{settingsInstance.name.substring(0, 40)}</span>
                      <Switch
                        checked={settingsInstance.visible}
                        onChange={(_, data) => {
                          settingsInstance.setVisibility(data.checked);
                        }}
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
                      value={settingsInstance.transferFunction.color}
                      onChange={(event) => {
                        const color = Utils.fromHexColor(event.target.value);
                        settingsInstance.transferFunction.setColor(
                          color.r,
                          color.g,
                          color.b
                        );
                      }}
                    />
                    <div className={classes.sliderContainer}>
                      <Label>Low bound</Label>
                      <Slider
                        value={settingsInstance.transferFunction.rampLow * 100}
                        min={0}
                        max={100}
                        onChange={(_, data) =>
                          settingsInstance.transferFunction.setRampLow(
                            data.value
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
                            data.value
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
                    <TFUploadElement
                      key={index}
                      settingsInstance={settingsInstance}
                    />
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
