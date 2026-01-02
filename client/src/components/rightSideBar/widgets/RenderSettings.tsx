import {
  makeStyles,
  Field,
  Slider,
  Switch,
  Text,
} from "@fluentui/react-components";
import { ArrowCircleRight28Regular } from "@fluentui/react-icons";
import globalStyles from "../../globalStyles";
import { observer } from "mobx-react-lite";
import { useMst } from "../../../stores/RootStore";

const useStyles = makeStyles({
  colorPicker: {
    marginTop: "0px",
    width: "50px",
    height: "33px",
    border: "none",
    cursor: "pointer",
    background: "none",
    marginLeft: "8px",
    padding: 0,
  },
  sliderContainer: {
    display: "flex",
    flex: 1,
    alignItems: "center",
  },
  subtitles: {
    marginBottom: "4px",
    marginTop: "12px",
  },
  sliderField: {
    display: "flex",
    flexGrow: 1,
    "& label": {
      minWidth: "130px",
    },
  },
  slider: {
    flexGrow: 1,
  },
  switchField: {
    display: "flex",
    flexGrow: 1,
    "& label": {
      flexGrow: 1,
    },
  },
  titleSwitchContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

interface Props {
  open: boolean;
  close: () => void;
}

const RenderSettings = observer(({ open, close }: Props) => {
  const { uiState } = useMst();

  const renderSettings = uiState.renderSettings;

  const classes = useStyles();
  const globalClasses = globalStyles();

  const handleChangeClearColor = (event: InputChangeEvent) => {
    const hex_code = event.target.value.split("");
    renderSettings.setClearColor(
      parseInt(hex_code[1] + hex_code[2], 16),
      parseInt(hex_code[3] + hex_code[4], 16),
      parseInt(hex_code[5] + hex_code[6], 16)
    );
  };

  return open ? (
    <div className={globalClasses.rightSidebar}>
      <div className={globalClasses.sidebarContents}>
        <div className={globalClasses.sidebarHeader}>
          <h1>Render Settings</h1>
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
            gap: "8px",
            justifyItems: "center",
            width: "100%",
            margin: "auto",
          }}
        >
          <h3 className={classes.subtitles}>Camera</h3>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Near Plane [{renderSettings.nearPlane}]</Text>}
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                value={renderSettings.nearPlane * 100}
                min={1}
                max={100}
                onChange={(_event, data) =>
                  renderSettings.setNearPlane(data.value / 100)
                }
              />
            </Field>
          </div>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Far Plane [{renderSettings.farPlane}]</Text>}
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                value={renderSettings.farPlane * 100}
                min={100}
                max={2000}
                onChange={(_event, data) =>
                  renderSettings.setFarPlane(data.value / 100)
                }
              />
            </Field>
          </div>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Background Color</Text>}
              className={classes.sliderField}
            >
              <input
                className={classes.colorPicker}
                type="color"
                value={
                  `#${renderSettings.clearColor[0]
                    .toString(16)
                    .padStart(2, "0")}` +
                  renderSettings.clearColor[1].toString(16).padStart(2, "0") +
                  renderSettings.clearColor[2].toString(16).padStart(2, "0")
                }
                onChange={(event) => handleChangeClearColor(event)}
              />
            </Field>
          </div>

          <h3 className={classes.subtitles}>Raycasting Settings</h3>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Sample Rate [{renderSettings.sampleRate}]</Text>}
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                value={renderSettings.sampleRate * 100}
                min={10}
                max={1000}
                onChange={(_event, data) =>
                  renderSettings.setSampleRate(data.value / 100)
                }
              />
            </Field>
          </div>
          <div className={classes.sliderContainer}>
            <Field
              className={classes.switchField}
              orientation="horizontal"
              label="Enable Early Ray Termination"
            >
              <Switch
                checked={renderSettings.enableEarlyRayTermination}
                onChange={(_event, data) =>
                  renderSettings.setEarlyRayTermination(data.checked)
                }
              />
            </Field>
          </div>
          <div className={classes.sliderContainer}>
            <Field
              className={classes.switchField}
              orientation="horizontal"
              label="Enable Jittering"
            >
              <Switch
                checked={renderSettings.enableJittering}
                onChange={(_event, data) =>
                  renderSettings.setJittering(data.checked)
                }
              />
            </Field>
          </div>

          {/* <h3 className={classes.subtitles}>Post Processing</h3>
          <div className={classes.sliderContainer}>
            <Field
              className={classes.switchField}
              orientation="horizontal"
              label="Bloom"
            >
              <Switch
                checked={renderSettings.enablePostProcessing}
                onChange={(event, data) =>
                  renderSettings.setPostProcessing(data.checked)
                }
              />
            </Field>
          </div> */}

          <div className={classes.titleSwitchContainer}>
            <h3 className={classes.subtitles}>Ambient Occlusion</h3>
            <Switch
              checked={renderSettings.enableAmbientOcclusion}
              onChange={(_event, data) =>
                renderSettings.setAmbientOcclusion(data.checked)
              }
            />
          </div>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Radius [{renderSettings.aoRadius}]</Text>}
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                disabled={!renderSettings.enableAmbientOcclusion}
                value={renderSettings.aoRadius * 1000}
                min={1}
                max={2000}
                onChange={(_event, data) =>
                  renderSettings.setAoRadius(data.value / 1000)
                }
              />
            </Field>
          </div>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={
                <Text>Number of Samples [{renderSettings.aoNumSamples}]</Text>
              }
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                disabled={!renderSettings.enableAmbientOcclusion}
                value={renderSettings.aoNumSamples}
                min={1}
                max={40}
                onChange={(_event, data) =>
                  renderSettings.setAoNumSamples(data.value)
                }
              />
            </Field>
          </div>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Strength [{renderSettings.aoStrength}]</Text>}
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                disabled={!renderSettings.enableAmbientOcclusion}
                value={renderSettings.aoStrength * 100}
                min={0}
                max={100}
                onChange={(_event, data) =>
                  renderSettings.setAoStrength(data.value / 100)
                }
              />
            </Field>
          </div>

          <div className={classes.titleSwitchContainer}>
            <h3 className={classes.subtitles}>Soft Shadows</h3>
            <Switch
              checked={renderSettings.enableSoftShadows}
              onChange={(_event, data) =>
                renderSettings.setSoftShadows(data.checked)
              }
            />
          </div>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Quality [{renderSettings.shadowQuality}]</Text>}
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                disabled={!renderSettings.enableSoftShadows}
                value={renderSettings.shadowQuality * 100}
                min={1}
                max={500}
                onChange={(_event, data) =>
                  renderSettings.setShadowQuality(data.value / 100)
                }
              />
            </Field>
          </div>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Strength [{renderSettings.shadowStrength}]</Text>}
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                disabled={!renderSettings.enableSoftShadows}
                value={renderSettings.shadowStrength * 100}
                min={0}
                max={100}
                onChange={(_event, data) =>
                  renderSettings.setShadowStrength(data.value / 100)
                }
              />
            </Field>
          </div>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Radius [{renderSettings.shadowRadius}]</Text>}
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                disabled={!renderSettings.enableSoftShadows}
                value={renderSettings.shadowRadius * 100}
                min={1}
                max={100}
                onChange={(_event, data) =>
                  renderSettings.setShadowRadius(data.value / 100)
                }
              />
            </Field>
          </div>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Threshold Min [{renderSettings.shadowMin}]</Text>}
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                disabled={!renderSettings.enableSoftShadows}
                value={renderSettings.shadowMin * 100}
                min={0}
                max={100}
                onChange={(_event, data) =>
                  renderSettings.setShadowMin(data.value / 100)
                }
              />
            </Field>
          </div>
          <div className={classes.sliderContainer}>
            <Field
              orientation="horizontal"
              label={<Text>Threshold Max [{renderSettings.shadowMax}]</Text>}
              className={classes.sliderField}
            >
              <Slider
                className={classes.slider}
                disabled={!renderSettings.enableSoftShadows}
                value={renderSettings.shadowMax * 100}
                min={0}
                max={100}
                onChange={(_event, data) =>
                  renderSettings.setShadowMax(data.value / 100)
                }
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  ) : null;
});

export default RenderSettings;
