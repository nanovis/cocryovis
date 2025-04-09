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
} from "@fluentui/react-components";
import { Document20Regular } from "@fluentui/react-icons";
import globalStyles from "../GlobalStyles";
import { TiltSeriesDialogInstance } from "../../stores/uiState/TiltSeriesDialog";
import {
  BooleanInputValidatedField,
  NumberInputValidatedField,
} from "./ValidatedFields";
import { observer } from "mobx-react-lite";
import { BooleanInputField, NumberInputField } from "../../functions/Input";
import Utils from "../../functions/Utils";
import { toast, Id } from "react-toastify";

const useStyles = makeStyles({
  optionsTabElement: {
    display: "flex",
    alignItems: "center",
  },
  optionsTabCheckbox: {
    marginLeft: "-12px",
  },
});

export interface TiltSeriesOptions {
  alignment?: { [key: string]: any };
  ctf?: { [key: string]: any };
  motionCorrection?: { [key: string]: any };
  reconstruction: { volume_depth: number; [key: string]: any };
}

interface Props {
  open: boolean;
  store: TiltSeriesDialogInstance;
  onClose: () => void;
  onSubmit: (
    file: File,
    options: TiltSeriesOptions,
    toastId: Id,
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

    const parseOptions = (
      optionsList: [string, NumberInputField | BooleanInputField][]
    ) => {
      const options: { [key: string]: any } = {};
      for (const [key, input] of optionsList) {
        if (!input.isValid()) {
          throw new Error(`Invalid input for ${input.name}`);
        }
        options[key] = input.convertToValue();
      }
      return options;
    };

    const handleSubmit = async () => {
      let toastId = null;
      try {
        toastId = toast.loading("Processing inputs...");
        if (!store.generalInputs.volume_depth.isValid()) {
          throw new Error("Invalid volume depth");
        }
        if (!store.pendingFile) {
          throw new Error("No file selected");
        }
        setIsBusy(true);

        const options: TiltSeriesOptions = {
          reconstruction: {
            volume_depth: store.generalInputs.volume_depth.convertToValue(),
          },
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
          options.reconstruction = {
            ...options.reconstruction,
            ...parseOptions(Object.entries(store.reconstructionInputs)),
          };
        }
        await onSubmit(store.pendingFile, options, toastId, store.serverSide);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        onClose();
        toast.update(toastId, {
          render: "Tilt series processed successfully.",
          type: "success",
          isLoading: false,
          autoClose: 2000,
        });
      } catch (error) {
        Utils.updateToastWithErrorMsg(toastId, error);
      } finally {
        setIsBusy(false);
      }
    };

    const handleButtonClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (event: FileChangeEvent) => {
      if (!event.target?.files || event.target.files.length < 1) {
        store.setPendingFile(null);
        return;
      }

      const file = event.target.files[0];
      if (file) {
        store.setPendingFile(file);
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
                    style={{ maxHeight: "400px", overflowY: "auto" }}
                    value={"1"}
                    disabled={!store.serverSide}
                  >
                    <AccordionHeader>
                      <Text> Advanced Options</Text>
                      <Text style={{ marginLeft: "auto" }} italic={true}>
                        Requires server-side processing.
                      </Text>
                    </AccordionHeader>
                    <AccordionPanel
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        rowGap: "10px",
                        margin: 0,
                      }}
                    >
                      <TabList
                        selectedValue={store.optionsTab}
                        onTabSelect={(_, data) =>
                          store.setOptionsTab(data.value as number)
                        }
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <div className={classes.optionsTabElement}>
                          <Tab
                            value={OptionTabs.Alignment}
                            disabled={!store.alignmentEnabled}
                          >
                            Alignment
                          </Tab>
                          <Checkbox
                            className={classes.optionsTabCheckbox}
                            checked={store.alignmentEnabled}
                            onChange={(_, data) =>
                              store.setAlignmentEnabled(data.checked as boolean)
                            }
                          />
                        </div>
                        <div className={classes.optionsTabElement}>
                          <Tab
                            value={OptionTabs.CTF}
                            disabled={!store.ctfEnabled}
                          >
                            CTF Estimation
                          </Tab>
                          <Checkbox
                            className={classes.optionsTabCheckbox}
                            checked={store.ctfEnabled}
                            onChange={(_, data) =>
                              store.setCtfEnabled(data.checked as boolean)
                            }
                          />
                        </div>
                        <div className={classes.optionsTabElement}>
                          <Tab
                            value={OptionTabs.MotionCorrection}
                            disabled={!store.motionCorrectionEnabled}
                          >
                            Motion Correction
                          </Tab>
                          <Checkbox
                            className={classes.optionsTabCheckbox}
                            checked={store.motionCorrectionEnabled}
                            onChange={(_, data) =>
                              store.setMotionCorrectionEnabled(
                                data.checked as boolean
                              )
                            }
                          />
                        </div>
                        <Tab value={OptionTabs.Reconstruction}>
                          Reconstruction
                        </Tab>
                      </TabList>
                      {store.optionsTab === OptionTabs.Alignment && (
                        <OptionsTab
                          inputList={Object.values(store.alignmentInputs)}
                          isBusy={isBusy}
                        />
                      )}
                      {store.optionsTab === OptionTabs.CTF && (
                        <OptionsTab
                          inputList={Object.values(store.ctfInputs)}
                          isBusy={isBusy}
                        />
                      )}
                      {store.optionsTab === OptionTabs.MotionCorrection && (
                        <OptionsTab
                          inputList={Object.values(
                            store.motionCorrectionInputs
                          )}
                          isBusy={isBusy}
                        />
                      )}
                      {store.optionsTab === OptionTabs.Reconstruction && (
                        <OptionsTab
                          inputList={Object.values(store.reconstructionInputs)}
                          isBusy={isBusy}
                        />
                      )}
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              )}

              <div
                style={{
                  display: "flex",
                  columnGap: "20px",
                  marginTop: "20px",
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

              <input
                ref={fileInputRef}
                type="file"
                accept=".mrc, .ali"
                style={{ display: "none" }}
                onChange={handleFileChange}
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
                onClick={handleSubmit}
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
    isBusy,
  }: {
    inputList: Array<NumberInputField | BooleanInputField>;
    isBusy: boolean;
  }) => {
    return (
      <div style={{ display: "flex", flexDirection: "column", rowGap: "10px" }}>
        {inputList.map((input, index) =>
          input instanceof BooleanInputField ? (
            <BooleanInputValidatedField
              key={index}
              input={input}
              labelPosition="before"
              disabled={isBusy}
            />
          ) : (
            <NumberInputValidatedField
              key={index}
              input={input}
              disabled={isBusy}
            />
          )
        )}
      </div>
    );
  }
);

export default ProcessTiltSeriesDialog;
