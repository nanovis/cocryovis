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
} from "../../functions/Input";

export const NumberInputValidatedField = ({
  value,
  setValue,
  input,
  disabled = false,
  style = {},
}: {
  value: string;
  setValue: (value: string) => void;
  input: NumberInputField;
  disabled?: boolean;
  style?: React.CSSProperties;
}) => {
  const getValidationState = () => {
    if (value === "") return "none";
    if (input.isValid(value)) return "success";
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
        value={value}
        onChange={(ev: InputChangeEvent, data: InputOnChangeData) => {
          setValue(data.value);
        }}
        placeholder={input.defaultValue.toString()}
        disabled={disabled}
      />
    </Field>
  );
};

export const BooleanInputValidatedField = ({
  value,
  setValue,
  input,
  labelPosition = "before",
  disabled = false,
  style = {},
}: {
  value: boolean;
  setValue: (value: boolean) => void;
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
        checked={value}
        onChange={(_, data: SwitchOnChangeData) => {
          setValue(data.checked);
        }}
        disabled={disabled}
      />
    </div>
  );
};

export const DropdownInputValidatedField = ({
  value,
  setValue,
  input,
  disabled = false,
  style = {},
}: {
  value: string;
  setValue: (value: string) => void;
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
        value={input.getText(value)}
        selectedOptions={[value]}
        onOptionSelect={(_, data: OptionOnSelectData) => {
          if (!data.optionValue) return;
          setValue(data.optionValue);
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
};
