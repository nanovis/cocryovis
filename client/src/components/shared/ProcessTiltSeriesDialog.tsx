import { useRef, useState } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Input,
  Field,
  makeStyles,
  Text,
  tokens,
  Switch,
  SwitchOnChangeData,
  InfoLabel,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  AccordionToggleEventHandler,
} from "@fluentui/react-components";
import { Document20Regular } from "@fluentui/react-icons";
import globalStyles from "../GlobalStyles";
import { toast } from "react-toastify";
import Utils from "../../functions/Utils";
import ValidatedField from "./ValidatedField";

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
  onClose: () => void;
  onSubmit: (
    file: File,
    options: TiltSeriesOptions,
    serverSide?: boolean
  ) => Promise<void>;
  showServerVariant?: boolean;
}

class InputField {
  name: string;
  validationMessage: string;

  constructor(name: string, validationMessage: string) {
    this.name = name;
    this.validationMessage = validationMessage;
  }

  isValid() {
    return true;
  }

  convertToValue() {
    throw new Error("Not implemented");
  }

  reset() {
    throw new Error("Not implemented");
  }
}

class StringInputField<T> extends InputField {
  value: string;
  setValue: (value: string) => void;
  valid: (value: string) => boolean;
  defaultValue: T;
  infoLabel: string;
  type: "integer" | "float";

  constructor(
    name: string,
    type: "integer" | "float",
    validationMessage: string,
    defaultValue: T,
    infoLabel: string,
    valid: (value: string) => boolean = (value: string) => true
  ) {
    super(name, validationMessage);
    const [value, setValue] = useState("");
    this.value = value;
    this.setValue = setValue;
    this.type = type;
    this.defaultValue = defaultValue;
    this.infoLabel = infoLabel;
    this.valid = valid;
  }

  isValid() {
    if (this.type === "integer") {
      return (
        this.value === "" ||
        (Utils.isInteger(this.value) && this.valid(this.value))
      );
    } else {
      return (
        this.value === "" ||
        (Utils.isFloat(this.value) && this.valid(this.value))
      );
    }
  }

  convertToValue() {
    if (this.value === "") {
      return this.defaultValue;
    } else if (this.type === "integer") {
      return parseInt(this.value, 10);
    } else {
      return parseFloat(this.value);
    }
  }

  reset() {
    this.setValue("");
  }
}

class BooleanInputField extends InputField {
  value: boolean;
  setValue: (value: boolean) => void;
  infoLabel: string;
  defaultValue: boolean;

  constructor(name: string, defaultValue: boolean, infoLabel: string) {
    super(name, `Invalid value for ${name}`);
    const [value, setValue] = useState(defaultValue);
    this.value = value;
    this.setValue = setValue;
    this.infoLabel = infoLabel;
    this.defaultValue = defaultValue;
  }

  convertToValue() {
    return this.value ? 1 : 0;
  }

  reset() {
    this.setValue(this.defaultValue);
  }
}

const ProcessTiltSeriesDialog = ({
  open,
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
    event: InputChangeEvent,
    data: SwitchOnChangeData
  ) => {
    setServerSide(data.checked);
    if (showAdvancedOptions.length > 0) {
      setShowAdvancedOptions([]);
    }
  };

  const [volumeDepth, setVolumeDepth] = useState("");
  const validVolumeDepth = volumeDepth === "" || parseInt(volumeDepth, 10) > 0;

  const [showAdvancedOptions, setShowAdvancedOptions] = useState<string[]>([]);
  const handleAdvancedOptionsToggle: AccordionToggleEventHandler<string> = (
    event,
    data
  ) => {
    setShowAdvancedOptions(data.openItems);
  };

  // Parameter names here are the same as option inputs in the cryoET
  const advancedOptions = {
    tiled: new BooleanInputField(
      "Tiled",
      true,
      "Whether the computation is done by tiles."
    ),
    crop: new BooleanInputField(
      "Crop",
      true,
      "Whether the results are cropped before saving."
    ),
    is_data_linearized: new BooleanInputField(
      "Linearized Data",
      false,
      "Whether the tilt series has been linearized previously."
    ),
    delinearize_result: new BooleanInputField(
      "Delinerize Result",
      true,
      "Whether the results are delinearized before saving."
    ),
    data_term_end: new BooleanInputField(
      "Run Final Data Term Operation",
      false,
      "Whether a final data term operation is run at the end of reconstruction."
    ),
    data_term_iters: new StringInputField(
      "Inner Iterations",
      "integer",
      "Inner Iterations must be an integer between 1 and 20.",
      2,
      "Number of data term (inner) iterations on each proximal algorithm iteration.",
      (value: string) => Utils.isIntegerBetween(value, 1, 20)
    ),
    proximal_iters: new StringInputField(
      "Outer Iterations",
      "integer",
      "Outer Iterations must be an integer between 1 and 200.",
      80,
      "Number of (outer) iterations of proximal algorithm.",
      (value: string) => Utils.isIntegerBetween(value, 1, 200)
    ),
    sample_rate: new StringInputField(
      "Sample Rate",
      "float",
      "Sample Rate must be between 0.25 and 1.",
      0.5,
      "Distance between samples in forward projection.",
      (value: string) => Utils.isFloatBetween(value, 0.25, 1)
    ),
    chill_factor: new StringInputField(
      "Chill Factor",
      "float",
      "Chill Factor must be between 0.001 and 1.",
      0.2,
      "Relaxation parameter for backprojection.",
      (value: string) => Utils.isFloatBetween(value, 0.001, 1)
    ),
    lambda: new StringInputField(
      "Lambda",
      "float",
      "Lambda must be between 0.1 and 2000.",
      1000,
      "Regularization parameter of data term proximal operator.",
      (value: string) => Utils.isFloatBetween(value, 0.1, 2000)
    ),
    number_extra_rows: new StringInputField(
      "Extra Rows",
      "integer",
      "Volume Depth must be an even integer above 60.",
      80,
      "Number of extra rows above and below each tile to prevent line artifacts. If for some reason line artifacts ocurr between the tiles, increase this value.",
      (value: string) =>
        Utils.isIntegerBetween(value, 60, Number.MAX_SAFE_INTEGER) &&
        Number(value) % 2 === 0
    ),
    starting_angle: new StringInputField(
      "Starting Angle",
      "float",
      "Starting Angle must be an valid number.",
      -60,
      "Starting point of the tilt-series. E.g. if the projections are from -60 to 60 degrees, the starting point is -60.",
      (value: string) => Utils.isFloat(value)
    ),
    angle_step: new StringInputField(
      "Angle Step",
      "float",
      "Angle Step must be an valid number.",
      3,
      "Angle step between projections. E.g. if the projections are -60, -67…, 57, 60."
    ),
    nlm_skip: new StringInputField(
      "NLM Skip",
      "integer",
      "NLM Skip must be an integer between 1 and 9.",
      3,
      "To skip some of the pixels in the search region during NLM. 3 provides almost the same result as no skip, but much faster.",
      (value: string) => Utils.isIntegerBetween(value, 1, 9)
    ),
  };

  const handleVolumeDepthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolumeDepth(e.target.value);
  };

  const getVolumeDepthValidationState = () => {
    if (volumeDepth === "") return "none";
    if (validVolumeDepth) return "success";
    return "error";
  };

  const handleSubmit = async () => {
    try {
      if (!validVolumeDepth || !file) {
        return;
      }
      setIsBusy(true);

      if (!validVolumeDepth) {
        throw new Error("Volume depth must be a positive integer.");
      }
      const options: TiltSeriesOptions = {
        volume_depth: Number(volumeDepth) || 50,
      };
      if (serverSide) {
        for (const [key, fieldSpecs] of Object.entries(advancedOptions)) {
          if (!fieldSpecs.isValid()) {
            throw new Error(fieldSpecs.validationMessage);
          }
          (options as any)[key] = fieldSpecs.convertToValue();
        }
      }

      await onSubmit(file, options, serverSide);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setVolumeDepth("");
      setFile(null);
      for (const [key, fieldSpecs] of Object.entries(advancedOptions)) {
        fieldSpecs.reset();
      }
      onClose();
    } catch (error) {
      const errMsg = Utils.getErrorMessage(error);
      toast.error(errMsg);
    } finally {
      setIsBusy(false);
    }
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
            <Field
              label="Volume Depth"
              validationState={getVolumeDepthValidationState()}
              validationMessage="Volume Depth must be a positive integer."
            >
              <Input
                appearance="underline"
                value={volumeDepth}
                onChange={handleVolumeDepthChange}
                placeholder="50"
                disabled={isBusy}
              />
            </Field>
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
                    {Object.entries(advancedOptions).map(([key, fieldSpecs]) =>
                      fieldSpecs instanceof BooleanInputField ? (
                        <Field
                          key={key}
                          orientation="horizontal"
                          label={
                            <InfoLabel info={fieldSpecs.infoLabel}>
                              {fieldSpecs.name}
                            </InfoLabel>
                          }
                          // style={{ display: "flex" }}
                        >
                          <Switch
                            checked={fieldSpecs.value}
                            onChange={(
                              ev: InputChangeEvent,
                              data: SwitchOnChangeData
                            ) => {
                              fieldSpecs.setValue(data.checked);
                            }}
                          />
                        </Field>
                      ) : (
                        <ValidatedField
                          key={key}
                          value={fieldSpecs.value}
                          setValue={fieldSpecs.setValue}
                          name={fieldSpecs.name}
                          valid={fieldSpecs.valid(fieldSpecs.value)}
                          validationMessage={fieldSpecs.validationMessage}
                          placeholder={fieldSpecs.defaultValue.toString()}
                          disabled={isBusy}
                          infoLabel={fieldSpecs.infoLabel}
                        />
                      )
                    )}
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            )}

            <div
              style={{ display: "flex", columnGap: "20px", marginTop: "20px" }}
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
            <Button appearance="secondary" onClick={onClose} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              disabled={!validVolumeDepth || !file || isBusy}
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
};

export default ProcessTiltSeriesDialog;
