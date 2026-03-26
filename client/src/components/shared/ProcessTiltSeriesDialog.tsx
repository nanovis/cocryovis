import { useRef, useState } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  makeStyles,
  Text,
  tokens,
  Switch,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  TabList,
  Tab,
  Checkbox,
  mergeClasses,
  Tooltip,
} from "@fluentui/react-components";
import {
  ArrowDownload24Regular,
  ArrowUpload24Regular,
  ClipboardPaste24Regular,
  Document20Regular,
} from "@fluentui/react-icons";
import globalStyles from "../globalStyles";
import type { TiltSeriesDialogInstance } from "@/stores/uiState/TiltSeriesDialog";
import {
  BooleanInputValidatedField,
  NumberInputValidatedField,
} from "./ValidatedFields";
import { observer } from "mobx-react-lite";
import type { NumberInputField } from "@/utils/input";
import { BooleanInputField } from "@/utils/input";
import * as Utils from "../../utils/helpers";
import ToastContainer from "../../utils/toastContainer";
import type z from "zod";
import { tiltSeriesOptions } from "@cocryovis/schemas/componentSchemas/tilt-series-schema";

const tiltSeriesOptionsInputSchema = tiltSeriesOptions.partial();

const useStyles = makeStyles({
  optionsTabCheckbox: {},
  optionsPanel: {
    display: "flex",
    flexDirection: "column",
    rowGap: "4px",
    margin: 0,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  optionsTabList: {
    "& > button": {
      height: "40px",
      borderRadius: 0,
      borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
      borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
      "&::before": {
        display: "none",
      },
      "&::after": {
        display: "none",
      },
      "& > span": {
        display: "flex",
        alignItems: "center",
      },
    },
    "& > button.activeTab:first-of-type": {
      borderLeft: "1px solid transparent",
    },
    "& > button:not(.activeTab)": {
      backgroundColor: tokens.colorNeutralBackground1,
      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    "& > button:last-of-type": {
      flexGrow: 1,
    },
    "& > button:not(.activeTab):last-of-type": {
      borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    },
  },
  checkboxOptionTab: {
    paddingRight: "0px",
    paddingLeft: "9px",
  },
  nonCheckboxOptionTab: {},
});

export interface TiltSeriesOptions {
  volume_depth: number;
  alignment?: Record<string, unknown>;
  ctf?: Record<string, unknown>;
  motionCorrection?: Record<string, unknown>;
  reconstruction?: Record<string, unknown>;
}

interface Props {
  open: boolean;
  store: TiltSeriesDialogInstance;
  onClose: () => void;
  onSubmit: (
    file: File,
    options: TiltSeriesOptions,
    toastContainer: ToastContainer,
    serverSide?: boolean
  ) => Promise<void>;
  showServerVariant?: boolean;
}

enum OptionTabs {
  Alignment,
  CTF,
  MotionCorrection,
  Reconstruction,
}

const ProcessTiltSeriesDialog = observer(
  ({ open, store, onClose, onSubmit, showServerVariant = false }: Props) => {
    const classes = useStyles();
    const globalClasses = globalStyles();

    const [isBusy, setIsBusy] = useState(false);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const jsonInputRef = useRef<HTMLInputElement | null>(null);

    const parseOptions = (
      optionsList: [string, NumberInputField | BooleanInputField][]
    ) => {
      const options: Record<string, unknown> = {};
      for (const [key, input] of optionsList) {
        if (!input.isValid()) {
          throw new Error(`Invalid input for ${input.name}`);
        }
        options[key] = input.convertToValue();
      }
      return options;
    };

    const handleSubmit = async () => {
      const toastContainer = new ToastContainer();
      try {
        toastContainer.loading("Processing inputs...");
        if (!store.generalInputs.volume_depth.isValid()) {
          throw new Error("Invalid volume depth");
        }
        if (!store.pendingFile) {
          throw new Error("No file selected");
        }
        setIsBusy(true);

        const options: TiltSeriesOptions = {
          volume_depth: store.generalInputs.volume_depth.convertToValue(),
        };
        if (store.serverSide) {
          if (store.alignmentEnabled) {
            options.alignment = parseOptions(
              Object.entries(store.alignmentInputs)
            );
          }
          if (store.ctfEnabled) {
            options.ctf = parseOptions(Object.entries(store.ctfInputs));
          }
          if (store.motionCorrectionEnabled) {
            options.motionCorrection = parseOptions(
              Object.entries(store.motionCorrectionInputs)
            );
          }
          options.reconstruction = parseOptions(
            Object.entries(store.reconstructionInputs)
          );
        }
        await onSubmit(
          store.pendingFile,
          options,
          toastContainer,
          store.serverSide
        );
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        onClose();
        toastContainer.success(
          store.serverSide
            ? "Tile series processing queued successfully."
            : "Tilt series processed successfully."
        );
      } catch (error) {
        toastContainer.error(Utils.getErrorMessage(error));
      } finally {
        setIsBusy(false);
      }
    };

    const handleButtonClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (event: FileChangeEvent) => {
      if (!event.target.files || event.target.files.length < 1) {
        store.setPendingFile(null);
        return;
      }

      const file = event.target.files[0];
      store.setPendingFile(file);
    };

    const loadSettings = (
      options: z.output<typeof tiltSeriesOptionsInputSchema>
    ) => {
      if (options.volume_depth !== undefined) {
        store.generalInputs.volume_depth.setValue(
          options.volume_depth.toString()
        );
      }

      if (
        options.reconstruction ||
        options.ctf ||
        options.motionCorrection ||
        options.alignment
      ) {
        store.setServerSide(true);
      }

      if (options.alignment) {
        store.setAlignmentEnabled(true);
        Object.entries(options.alignment).forEach(([key, value]) => {
          if (key in store.alignmentInputs) {
            store.alignmentInputs[
              key as keyof typeof store.alignmentInputs
            ].setValue(value.toString());
          }
        });
      }

      if (options.ctf) {
        store.setCtfEnabled(true);
        Object.entries(options.ctf).forEach(([key, value]) => {
          if (key in store.ctfInputs) {
            store.ctfInputs[key as keyof typeof store.ctfInputs].setValue(
              value.toString()
            );
          }
        });
      }

      if (options.motionCorrection) {
        store.setMotionCorrectionEnabled(true);
        Object.entries(options.motionCorrection).forEach(([key, value]) => {
          if (key in store.motionCorrectionInputs) {
            store.motionCorrectionInputs[
              key as keyof typeof store.motionCorrectionInputs
            ].setValue(value.toString());
          }
        });
      }

      if (options.reconstruction) {
        Object.entries(options.reconstruction).forEach(([key, value]) => {
          if (key in store.reconstructionInputs) {
            const input =
              store.reconstructionInputs[
                key as keyof typeof store.reconstructionInputs
              ];
            if (input instanceof BooleanInputField) {
              input.setValue(value === true);
            } else {
              input.setValue(value.toString());
            }
          }
        });
      }
    };

    const handleImport = async (event: FileChangeEvent) => {
      const toastContainer = new ToastContainer();
      try {
        if (!event.target.files || event.target.files.length < 1) {
          return;
        }

        const file = event.target.files[0];
        const text = await file.text();
        const options = tiltSeriesOptionsInputSchema.parse(JSON.parse(text));

        loadSettings(options);
        toastContainer.success("Settings loaded from file.");
      } catch (error) {
        toastContainer.error(Utils.getErrorMessage(error));
      } finally {
        if (jsonInputRef.current) {
          jsonInputRef.current.value = "";
        }
      }
    };

    const handleUploadClick = () => {
      jsonInputRef.current?.click();
    };

    const handlePaste = async () => {
      const toastContainer = new ToastContainer();
      try {
        const text = await navigator.clipboard.readText();
        const options = tiltSeriesOptionsInputSchema.parse(JSON.parse(text));

        loadSettings(options);
        toastContainer.success("Settings loaded from clipboard.");
      } catch (error) {
        toastContainer.error(Utils.getErrorMessage(error));
      }
    };

    const handleExport = () => {
      const toastContainer = new ToastContainer();
      try {
        if (!store.generalInputs.volume_depth.isValid()) {
          throw new Error("Invalid volume depth");
        }

        const options: Record<string, unknown> = {
          volume_depth: store.generalInputs.volume_depth.convertToValue(),
        };

        if (store.serverSide) {
          if (store.alignmentEnabled) {
            options.alignment = parseOptions(
              Object.entries(store.alignmentInputs)
            );
          }
          if (store.ctfEnabled) {
            options.ctf = parseOptions(Object.entries(store.ctfInputs));
          }
          if (store.motionCorrectionEnabled) {
            options.motionCorrection = parseOptions(
              Object.entries(store.motionCorrectionInputs)
            );
          }
          options.reconstruction = parseOptions(
            Object.entries(store.reconstructionInputs)
          );
        }

        const json = JSON.stringify(options, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        Utils.downloadBlob(blob, "tilt_series_processing_settings.json");

        toastContainer.success("Settings downloaded successfully.");
      } catch (error) {
        toastContainer.error(Utils.getErrorMessage(error));
      }
    };

    return (
      <Dialog open={open}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              Process Tilt Series
              {showServerVariant && (
                <Switch
                  style={{ alignSelf: "end" }}
                  checked={store.serverSide}
                  label={`Server side`}
                  labelPosition="before"
                  onChange={(_, data) => store.setServerSide(data.checked)}
                />
              )}
            </DialogTitle>
            <DialogContent
              style={{
                display: "flex",
                flexDirection: "column",
                paddingTop: "15px",
                paddingBottom: "15px",
                rowGap: "10px",
              }}
            >
              <NumberInputValidatedField
                input={store.generalInputs.volume_depth}
              />
              {showServerVariant && (
                <Accordion
                  openItems={
                    store.showAdvancedOptions && store.serverSide ? ["1"] : []
                  }
                  onToggle={(_, data) => {
                    store.setShowAdvancedOptions(data.openItems.length > 0);
                  }}
                  collapsible
                >
                  <AccordionItem
                    style={{
                      maxHeight: "400px",
                      overflowY: "auto",
                    }}
                    value={"1"}
                    disabled={!store.serverSide}
                  >
                    <AccordionHeader>
                      <Text> Advanced Options</Text>
                      <Text style={{ marginLeft: "auto" }} italic={true}>
                        Requires server-side processing.
                      </Text>
                    </AccordionHeader>
                    <AccordionPanel className={classes.optionsPanel}>
                      <TabList
                        selectedValue={store.optionsTab}
                        onTabSelect={(_, data) =>
                          store.setOptionsTab(data.value as number)
                        }
                        className={classes.optionsTabList}
                        style={{
                          display: "flex",
                          gap: "-1px",
                        }}
                      >
                        <Tab
                          value={OptionTabs.Alignment}
                          className={mergeClasses(
                            classes.checkboxOptionTab,
                            store.optionsTab ===
                              (OptionTabs.Alignment as number) && "activeTab"
                          )}
                        >
                          Alignment
                          <Checkbox
                            checked={store.alignmentEnabled}
                            className={classes.optionsTabCheckbox}
                            onChange={(_, data) =>
                              store.setAlignmentEnabled(data.checked as boolean)
                            }
                          />
                        </Tab>
                        <Tab
                          value={OptionTabs.CTF}
                          className={mergeClasses(
                            classes.checkboxOptionTab,
                            store.optionsTab === (OptionTabs.CTF as number) &&
                              "activeTab"
                          )}
                        >
                          CTF Estimation
                          <Checkbox
                            className={classes.optionsTabCheckbox}
                            checked={store.ctfEnabled}
                            onChange={(_, data) =>
                              store.setCtfEnabled(data.checked as boolean)
                            }
                          />
                        </Tab>
                        <Tab
                          value={OptionTabs.MotionCorrection}
                          className={mergeClasses(
                            classes.checkboxOptionTab,
                            store.optionsTab ===
                              (OptionTabs.MotionCorrection as number) &&
                              "activeTab"
                          )}
                        >
                          Motion Correction
                          <Checkbox
                            className={classes.optionsTabCheckbox}
                            checked={store.motionCorrectionEnabled}
                            onChange={(_, data) =>
                              store.setMotionCorrectionEnabled(
                                data.checked as boolean
                              )
                            }
                          />
                        </Tab>
                        <Tab
                          value={OptionTabs.Reconstruction}
                          className={mergeClasses(
                            classes.nonCheckboxOptionTab,
                            store.optionsTab ===
                              (OptionTabs.Reconstruction as number) &&
                              "activeTab"
                          )}
                        >
                          Reconstruction
                        </Tab>
                      </TabList>
                      {store.optionsTab ===
                        (OptionTabs.Alignment as number) && (
                        <OptionsTab
                          inputList={Object.values(store.alignmentInputs)}
                          disabled={isBusy || !store.alignmentEnabled}
                        />
                      )}
                      {store.optionsTab === (OptionTabs.CTF as number) && (
                        <OptionsTab
                          inputList={Object.values(store.ctfInputs)}
                          disabled={isBusy || !store.ctfEnabled}
                        />
                      )}
                      {store.optionsTab ===
                        (OptionTabs.MotionCorrection as number) && (
                        <OptionsTab
                          inputList={Object.values(
                            store.motionCorrectionInputs
                          )}
                          disabled={isBusy || !store.motionCorrectionEnabled}
                        />
                      )}
                      {store.optionsTab ===
                        (OptionTabs.Reconstruction as number) && (
                        <OptionsTab
                          inputList={Object.values(store.reconstructionInputs)}
                          disabled={isBusy}
                        />
                      )}
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    columnGap: "20px",
                    alignItems: "center",
                  }}
                >
                  <Button
                    onClick={handleButtonClick}
                    appearance="primary"
                    className={globalClasses.actionButton}
                    style={{ width: "150px", height: "35px" }}
                    disabled={isBusy}
                  >
                    <div className={globalClasses.actionButtonIconContainer}>
                      <Document20Regular />
                    </div>

                    <div className="buttonText">Select File</div>
                  </Button>
                  <Text
                    style={{
                      alignSelf: "center",
                      color: tokens.colorNeutralForeground2,
                    }}
                  >
                    {store.pendingFile
                      ? store.pendingFile.name
                      : "No file selected."}
                  </Text>
                </div>
                <div
                  style={{ display: "flex", gap: "10px", alignItems: "center" }}
                >
                  <Tooltip
                    content="Download settings as a JSON file"
                    relationship="label"
                    appearance="inverted"
                  >
                    <Button
                      icon={<ArrowDownload24Regular />}
                      onClick={handleExport}
                      disabled={isBusy}
                    />
                  </Tooltip>
                  <Tooltip
                    content="Import settings from JSON file"
                    relationship="label"
                    appearance="inverted"
                  >
                    <Button
                      icon={<ArrowUpload24Regular />}
                      onClick={handleUploadClick}
                      disabled={isBusy}
                    />
                  </Tooltip>
                  <Tooltip
                    content="Load settings from clipboard"
                    relationship="label"
                    appearance="inverted"
                  >
                    <Button
                      icon={<ClipboardPaste24Regular />}
                      onClick={() => {
                        void handlePaste();
                      }}
                      disabled={isBusy}
                    />
                  </Tooltip>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".mrc, .ali"
                style={{ display: "none" }}
                onChange={handleFileChange}
                disabled={isBusy}
              />
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={(event) => void handleImport(event)}
                disabled={isBusy}
              />
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={onClose}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  !store.generalInputs.volume_depth.isValid() ||
                  !store.pendingFile ||
                  isBusy
                }
                appearance="primary"
                onClick={() => {
                  handleSubmit().catch(console.error);
                }}
              >
                Submit
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  }
);

const OptionsTab = observer(
  ({
    inputList,
    disabled,
  }: {
    inputList: (NumberInputField | BooleanInputField)[];
    disabled: boolean;
  }) => {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          rowGap: "10px",
          padding: "8px",
        }}
      >
        {inputList.map((input, index) =>
          input instanceof BooleanInputField ? (
            <BooleanInputValidatedField
              // Static list of inputs.
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={index}
              input={input}
              labelPosition="before"
              disabled={disabled}
            />
          ) : (
            <NumberInputValidatedField
              // Static list of inputs.
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={index}
              input={input}
              disabled={disabled}
            />
          )
        )}
      </div>
    );
  }
);

export default ProcessTiltSeriesDialog;
