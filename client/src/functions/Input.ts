import Utils from "./Utils";

abstract class InputField<T> {
  name: string;
  infoLabel: string | null;
  getValue: () => T;
  setValue: (value: T) => void;

  constructor(
    name: string,
    getValue: () => T,
    setValue: (value: T) => void,
    infoLabel: string | null = null
  ) {
    this.name = name;
    this.infoLabel = infoLabel;
    this.getValue = getValue;
    this.setValue = setValue;
  }

  abstract isValid(): boolean;

  abstract convertToValue(): any;
}

export enum StringInputFieldType {
  INTEGER,
  FLOAT,
}

export class NumberInputField extends InputField<string> {
  defaultValue: number;
  type: StringInputFieldType;
  validationMessage: string;
  valid: (value: number) => boolean;

  constructor(
    name: string,
    getValue: () => string,
    setValue: (value: string) => void,
    type: StringInputFieldType,
    validationMessage: string,
    defaultValue: number,
    infoLabel: string | null = null,
    valid: (value: number) => boolean = () => true
  ) {
    super(name, getValue, setValue, infoLabel);
    this.type = type;
    this.validationMessage = validationMessage;
    this.defaultValue = defaultValue;
    this.valid = valid;
  }

  isValid() {
    const value = this.getValue();
    if (this.type === StringInputFieldType.INTEGER) {
      const parsedValue = parseInt(value);
      return (
        value === "" || (Utils.isInteger(value) && this.valid(parsedValue))
      );
    } else {
      const parsedValue = parseFloat(value);
      return value === "" || (Utils.isFloat(value) && this.valid(parsedValue));
    }
  }

  convertToValue() {
    const value = this.getValue();
    if (value === "") {
      return this.defaultValue;
    } else if (StringInputFieldType.INTEGER) {
      return parseInt(value, 10);
    } else {
      return parseFloat(value);
    }
  }
}

export class DropdownInputField extends InputField<string> {
  options: Record<string, string>;
  defaultValue: string;

  constructor(
    name: string,
    getValue: () => string,
    setValue: (value: string) => void,
    options: Record<string, string>,
    defaultValue: string,
    infoLabel: string | null = null
  ) {
    super(name, getValue, setValue, infoLabel);
    this.options = options;
    this.defaultValue = defaultValue;
  }

  isValid() {
    return this.getValue() in this.options;
  }
  getText() {
    return this.options[this.getValue()];
  }
  convertToValue() {
    return this.getValue();
  }
}

export class BooleanInputField extends InputField<boolean> {
  defaultValue: boolean;

  constructor(
    name: string,
    getValue: () => boolean,
    setValue: (value: boolean) => void,
    defaultValue: boolean,
    infoLabel: string | null = null
  ) {
    super(name, getValue, setValue, infoLabel);
    this.defaultValue = defaultValue;
  }

  convertToValue() {
    return this.getValue();
  }

  isValid(): boolean {
    return true;
  }
}
