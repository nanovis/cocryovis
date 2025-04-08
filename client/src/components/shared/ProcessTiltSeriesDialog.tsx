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
  SwitchOnChangeData,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  AccordionToggleEventHandler,
} from "@fluentui/react-components";
import { Document20Regular } from "@fluentui/react-icons";
import globalStyles from "../GlobalStyles";
import { TiltSeriesDialogInstance } from "../../stores/uiState/TiltSeriesDialog";
import {
  BooleanInputValidatedField,
  NumberInputValidatedField,
} from "./ValidatedFields";
import { observer } from "mobx-react-lite";
import { BooleanInputField } from "../../functions/Input";

const useStyles = makeStyles({});

export interface TiltSeriesOptions {
  volume_depth: number;
  tiled?: boolean;
  crop?: boolean;
  is_data_linearized?: boolean;
  delinearize_result?: boolean;
  data_term_end?: boolean;
  data_term_iters?: number;
  proximal_iters?: number;
  sample_rate?: number;
  chill_factor?: number;
  lambda?: number;
  number_extra_rows?: number;
  starting_angle?: number;
  angle_step?: number;
  nlm_skip?: number;
}

interface Props {
  open: boolean;
  tiltSeriesDialogStore: TiltSeriesDialogInstance;
  onClose: () => void;
  onSubmit: (
    file: File,
    options: TiltSeriesOptions,
    serverSide?: boolean
  ) => Promise<void>;
  showServerVariant?: boolean;
}

const ProcessTiltSeriesDialog = observer(
  ({
    open,
    tiltSeriesDialogStore,
    onClose,
    onSubmit,
    showServerVariant = false,
  }: Props) => {
    const classes = useStyles();
    const globalClasses = globalStyles();

    const [isBusy, setIsBusy] = useState(false);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [serverSide, setServerSide] = useState(false);
    const handleServerSideToggle = (
      _: InputChangeEvent,
      data: SwitchOnChangeData
    ) => {
      setServerSide(data.checked);
      if (showAdvancedOptions.length > 0) {
        setShowAdvancedOptions([]);
      }
    };

    const [showAdvancedOptions, setShowAdvancedOptions] = useState<string[]>(
      []
    );
    const handleAdvancedOptionsToggle: AccordionToggleEventHandler<string> = (
      _,
      data
    ) => {
      setShowAdvancedOptions(data.openItems);
    };

    const handleSubmit = async () => {
      // try {
      //   if (!validVolumeDepth || !file) {
      //     return;
      //   }
      //   setIsBusy(true);
      //   if (!validVolumeDepth) {
      //     throw new Error("Volume depth must be a positive integer.");
      //   }
      //   const options: TiltSeriesOptions = {
      //     volume_depth: Number(volumeDepth) || 50,
      //   };
      //   if (serverSide) {
      //     for (const [key, fieldSpecs] of Object.entries(advancedOptions)) {
      //       if (!fieldSpecs.isValid()) {
      //         throw new Error(fieldSpecs.validationMessage);
      //       }
      //       (options as any)[key] = fieldSpecs.convertToValue();
      //     }
      //   }
      //   await onSubmit(file, options, serverSide);
      //   if (fileInputRef.current) {
      //     fileInputRef.current.value = "";
      //   }
      //   setVolumeDepth("");
      //   setFile(null);
      //   for (const [key, fieldSpecs] of Object.entries(advancedOptions)) {
      //     fieldSpecs.reset();
      //   }
      //   onClose();
      // } catch (error) {
      //   const errMsg = Utils.getErrorMessage(error);
      //   toast.error(errMsg);
      // } finally {
      //   setIsBusy(false);
      // }
    };

    const handleButtonClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (event: FileChangeEvent) => {
      if (!event.target?.files || event.target.files.length < 1) {
        setFile(null);
        return;
      }
      const file = event.target.files[0];
      if (file) {
        setFile(file);
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
                  checked={serverSide}
                  label={`Server side`}
                  labelPosition="before"
                  onChange={handleServerSideToggle}
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
                input={tiltSeriesDialogStore.volumeDepthInput}
              />
              {/* <Field
              label="Volume Depth"
              validationState={getVolumeDepthValidationState()}
              validationMessage="Volume Depth must be a positive integer."
            >
              <Input
                appearance="underline"
                value={tiltSeriesDialogStore.volumeDepth}
                onChange={(value) => {
                  tiltSeriesDialogStore.;
                }}
                placeholder="50"
                disabled={isBusy}
              />
            </Field> */}
              {showServerVariant && (
                <Accordion
                  openItems={showAdvancedOptions}
                  onToggle={handleAdvancedOptionsToggle}
                  collapsible
                >
                  <AccordionItem
                    style={{ maxHeight: "400px", overflowY: "auto" }}
                    value="1"
                    disabled={!serverSide}
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
                      }}
                    >
                      {Object.entries(
                        tiltSeriesDialogStore.reconstructionInputs
                      ).map(([key, fieldSpecs]) =>
                        fieldSpecs instanceof BooleanInputField ? (
                          <BooleanInputValidatedField
                            key={key}
                            input={fieldSpecs}
                            labelPosition="before"
                            disabled={isBusy}
                          />
                        ) : (
                          <NumberInputValidatedField
                            key={key}
                            input={fieldSpecs}
                            disabled={isBusy}
                            style={{ width: "300px" }}
                          />
                        )
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
                  {file ? file.name : "No file selected."}
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
                // disabled={!validVolumeDepth || !file || isBusy}
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

export default ProcessTiltSeriesDialog;
