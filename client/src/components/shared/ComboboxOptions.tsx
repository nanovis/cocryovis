import type {
  CheckpointComboboxOption,
  CheckpointWithModelComboboxOption,
} from "@/stores/userState/CheckpointModel";
import type { ModelComboboxOption } from "@/stores/userState/ModelModel";
import type { ResultComboboxOption } from "@/stores/userState/ResultModel";
import type { VolumeComboboxOption } from "@/stores/userState/VolumeModel";
import { Tooltip, Option, type TooltipProps } from "@fluentui/react-components";

const selectionDropdownTooltipStyle: React.CSSProperties = {
  minHeight: "20px",
  alignContent: "center",
};

const tooltipProps: RequireFields<Partial<TooltipProps>, "relationship"> = {
  hideDelay: 0,
  showDelay: 0,
  positioning: "after",
  relationship: "description",
};

export function modelTooltip(props: ModelComboboxOption) {
  return (
    <div style={selectionDropdownTooltipStyle}>
      <b>ID:</b> {props.value}
      {props.description.length > 0 && (
        <>
          <br />
          <b>Description:</b> {props.description}
        </>
      )}
    </div>
  );
}

export function modelRenderOption(props: ModelComboboxOption) {
  return (
    <Tooltip key={props.value} {...tooltipProps} content={modelTooltip(props)}>
      <Option value={props.value}>{props.children}</Option>
    </Tooltip>
  );
}

export function checkpointTooltip(props: CheckpointComboboxOption) {
  return (
    <div style={selectionDropdownTooltipStyle}>
      <b>ID:</b> {props.value}
    </div>
  );
}

export function checkpointRenderOption(props: CheckpointComboboxOption) {
  return (
    <Tooltip
      key={props.value}
      {...tooltipProps}
      content={checkpointTooltip(props)}
    >
      <Option value={props.value}>{props.children}</Option>
    </Tooltip>
  );
}

export function checkpointTooltipWithModel(
  props: CheckpointWithModelComboboxOption
) {
  return (
    <div style={selectionDropdownTooltipStyle}>
      <b>ID:</b> {props.value}
      <br />
      <b>Model:</b> {props.modelName}
    </div>
  );
}

export function checkpointRenderOptionWithModel(
  props: CheckpointWithModelComboboxOption
) {
  return (
    <Tooltip
      key={props.value}
      {...tooltipProps}
      content={checkpointTooltipWithModel(props)}
    >
      <Option value={props.value}>{props.children}</Option>
    </Tooltip>
  );
}

export function volumeTooltip(props: VolumeComboboxOption) {
  return (
    <div style={selectionDropdownTooltipStyle}>
      <b>ID:</b> {props.value}
      {props.description.length > 0 && (
        <>
          <br />
          <b>Description:</b> {props.description}
        </>
      )}
    </div>
  );
}

export function volumeRenderOption(props: VolumeComboboxOption) {
  return (
    <Tooltip key={props.value} {...tooltipProps} content={volumeTooltip(props)}>
      <Option value={props.value}>{props.children}</Option>
    </Tooltip>
  );
}

export function resultTooltip(props: ResultComboboxOption) {
  return (
    <div style={selectionDropdownTooltipStyle}>
      <b>ID:</b> {props.value}
      {props.checkpoint.length > 0 && (
        <>
          <br />
          <b>Checkpoint:</b> {props.checkpoint}
        </>
      )}
    </div>
  );
}

export function resultRenderOption(props: ResultComboboxOption) {
  return (
    <Tooltip key={props.value} {...tooltipProps} content={resultTooltip(props)}>
      <Option value={props.value}>{props.children}</Option>
    </Tooltip>
  );
}
