import {
  Input,
  Field,
  InputOnChangeData,
  InfoLabel,
} from "@fluentui/react-components";

interface Props {
  value: string;
  setValue: (value: string) => void;
  name: string;
  valid: boolean;
  validationMessage: string;
  placeholder: string;
  disabled?: boolean;
  infoLabel?: string | null;
}

const ValidatedField = ({
  value,
  setValue,
  name,
  valid,
  validationMessage,
  placeholder,
  disabled = false,
  infoLabel = null,
}: Props) => {
  const getValidationState = () => {
    if (value === "") return "none";
    if (valid) return "success";
    return "error";
  };

  return (
    <Field
      label={
        infoLabel ? (
          <InfoLabel info={infoLabel}>{name}</InfoLabel>
        ) : (
          <InfoLabel>{name}</InfoLabel>
        )
      }
      validationState={getValidationState()}
      validationMessage={validationMessage}
    >
      <Input
        appearance="underline"
        value={value}
        onChange={(ev: InputChangeEvent, data: InputOnChangeData) => {
          setValue(data.value);
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
    </Field>
  );
};

export default ValidatedField;
