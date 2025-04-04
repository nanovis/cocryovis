import Utils from "./Utils";

abstract class InputField {
  name: string;
  infoLabel: string | null;

  constructor(name: string, infoLabel: string | null = null) {
    this.name = name;
    this.infoLabel = infoLabel;
  }

  abstract isValid(value: any): boolean;

  abstract convertToValue(value: any): any;
}

export enum StringInputFieldType {
  INTEGER,
  FLOAT,
}

export class NumberInputField extends InputField {
  defaultValue: number;
  type: StringInputFieldType;
  validationMessage: string;
  valid: (value: number) => boolean;

  constructor(
    name: string,
    type: StringInputFieldType,
    validationMessage: string,
    defaultValue: number,
    infoLabel: string | null = null,
    valid: (value: number) => boolean = (value: number) => true,
  ) {
    super(name, infoLabel);
    this.type = type;
    this.validationMessage = validationMessage;
    this.defaultValue = defaultValue;
    this.valid = valid;
  }

  isValid(value: string) {
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

  convertToValue(value: string) {
    if (value === "") {
      return this.defaultValue;
    } else if (StringInputFieldType.INTEGER) {
      return parseInt(value, 10);
    } else {
      return parseFloat(value);
    }
  }
}

export class DropdownInputField extends InputField {
  options: Record<string, string>;
  defaultValue: string;

  constructor(
    name: string,
    options: Record<string, string>,
    defaultValue: string,
    infoLabel: string | null = null,
  ) {
    super(name, infoLabel);
    this.options = options;
    this.defaultValue = defaultValue;
  }

  isValid(value: string) {
    return value in this.options;
  }
  getText(value: string) {
    return this.options[value];
  }
  convertToValue(value: string) {
    return value;
  }
}

export class BooleanInputField extends InputField {
  defaultValue: boolean;

  constructor(
    name: string,
    defaultValue: boolean,
    infoLabel: string | null = null,
  ) {
    super(name, infoLabel);
    this.defaultValue = defaultValue;
  }

  convertToValue(value: boolean) {
    return value;
  }

  isValid(value: boolean): boolean {
    return true;
  }
}
