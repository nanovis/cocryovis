import {
  Input,
  Field,
  InputOnChangeData,
  InfoLabel,
  Switch,
  SwitchOnChangeData,
  Dropdown,
  Option,
  OptionOnSelectData,
} from "@fluentui/react-components";
import {
  BooleanInputField,
  DropdownInputField,
  NumberInputField,
} from "../../utils/Input";
import { observer } from "mobx-react-lite";

export const NumberInputValidatedField = observer(
  ({
    input,
    disabled = false,
    style = {},
  }: {
    input: NumberInputField;
    disabled?: boolean;
    style?: React.CSSProperties;
  }) => {
    const getValidationState = () => {
      if (input.getValue() === "") return "none";
      if (input.isValid()) return "success";
      return "error";
    };

    return (
      <Field
        label={
          input.infoLabel ? (
            <InfoLabel info={input.infoLabel}>{input.name}</InfoLabel>
          ) : (
            <InfoLabel>{input.name}</InfoLabel>
          )
        }
        validationState={getValidationState()}
        validationMessage={input.validationMessage}
        style={style}
      >
        <Input
          appearance="underline"
          value={input.getValue()}
          onChange={(ev: InputChangeEvent, data: InputOnChangeData) => {
            input.setValue(data.value);
          }}
          placeholder={input.placeholder()}
          disabled={disabled}
        />
      </Field>
    );
  }
);

export const BooleanInputValidatedField = observer(
  ({
    input,
    labelPosition = "before",
    disabled = false,
    style = {},
  }: {
    input: BooleanInputField;
    labelPosition?: "above" | "after" | "before";
    disabled?: boolean;
    style?: React.CSSProperties;
  }) => {
    return (
      <div style={style}>
        <Switch
          label={{
            children: input.infoLabel ? (
              <InfoLabel info={input.infoLabel}>{input.name}</InfoLabel>
            ) : (
              <InfoLabel>{input.name}</InfoLabel>
            ),
            style: { paddingLeft: 0 },
          }}
          labelPosition={labelPosition}
          checked={input.getValue()}
          onChange={(_, data: SwitchOnChangeData) => {
            input.setValue(data.checked);
          }}
          disabled={disabled}
        />
      </div>
    );
  }
);

export const DropdownInputValidatedField = observer(
  ({
    input,
    disabled = false,
    style = {},
  }: {
    input: DropdownInputField;
    disabled?: boolean;
    style?: React.CSSProperties;
  }) => {
    return (
      <Field
        label={
          input.infoLabel ? (
            <InfoLabel info={input.infoLabel}>{input.name}</InfoLabel>
          ) : (
            <InfoLabel>{input.name}</InfoLabel>
          )
        }
        style={style}
      >
        <Dropdown
          value={input.getText()}
          selectedOptions={[input.getValue()]}
          onOptionSelect={(_, data: OptionOnSelectData) => {
            if (!data.optionValue) return;
            input.setValue(data.optionValue);
          }}
          style={{ minWidth: "100%" }}
          disabled={disabled}
        >
          {Object.entries(input.options).map(([key, text]) => (
            <Option key={key} text={text} value={key}>
              {text}
            </Option>
          ))}
        </Dropdown>
      </Field>
    );
  }
);
