import {
  Combobox,
  OptionOnSelectData,
  SelectionEvents,
  useComboboxFilter,
} from "@fluentui/react-components";

import { makeStyles, Tooltip } from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";
import TooltipWrapper from "./TooltipWrapper";

const useStyles = makeStyles({});

interface Props<
  T extends {
    children: React.ReactNode | string;
    value: string;
    tooltip?: JSX.Element;
  }
> {
  selectionList: T[];
  selectedOption: T | undefined;
  onOptionSelect: (data: string | null) => void;
  placeholder: string;
  noOptionsMessage: string;
  optionToText?: (option: T) => string;
  renderOption?: (props: T) => JSX.Element;
  className?: string;
  showTooltip?: boolean;
  disabled?: boolean;
  clearable?: boolean;
}

const ComboboxSearch = <
  T extends {
    children: React.ReactNode | string;
    value: string;
    tooltip?: JSX.Element;
  }
>({
  selectionList,
  selectedOption,
  onOptionSelect,
  placeholder,
  noOptionsMessage,
  optionToText = ({ children, value, tooltip }) => children as string,
  renderOption = undefined,
  className = undefined,
  showTooltip = true,
  disabled = false,
  clearable = false,
}: Props<T>) => {
  const classes = useStyles();

  const [searchQuery, setSearchQuery] = useState(
    selectedOption ? optionToText(selectedOption) : ""
  );

  const [open, setOpen] = useState(false);

  const [visibleTooltip, setVisibleTooltip] = useState(false);

  // Prevents on close effect from being executed after selecting an option
  const blockClosed = useRef(false);

  useEffect(() => {
    setSearchQuery(selectedOption ? optionToText(selectedOption) : "");
  }, [selectedOption]);

  const selectionOptions = useComboboxFilter(searchQuery, selectionList, {
    noOptionsMessage: noOptionsMessage,
    optionToText: optionToText,
    renderOption: renderOption,
  });

  const handleOptionSelect = (
    event: SelectionEvents,
    data: OptionOnSelectData
  ) => {
    if (!data.optionValue || data.optionValue.length === 0) {
      onOptionSelect(null);
      return;
    }
    onOptionSelect(data.optionValue ?? null);
    blockClosed.current = true;
  };

  const handleOpenChange = (
    e:
      | React.MouseEvent<HTMLElement>
      | React.KeyboardEvent<HTMLElement>
      | React.FocusEvent<HTMLElement>,
    data: { open: boolean }
  ) => {
    setOpen(data.open);
    if (data.open && selectedOption) {
      setSearchQuery("");
    } else if (!data.open && !blockClosed.current && selectedOption) {
      setSearchQuery(optionToText(selectedOption));
    }
    blockClosed.current = false;
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const onMouseEnter = () => {
    setVisibleTooltip(true);
  };
  const onMouseLeave = () => {
    setVisibleTooltip(false);
  };

  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "row" }}
    >
      <Combobox
        disableAutoFocus={true}
        onOptionSelect={handleOptionSelect}
        placeholder={placeholder}
        onChange={onChange}
        value={searchQuery}
        positioning={{ autoSize: "width" }}
        selectedOptions={
          selectedOption ? [selectedOption.value.toString()] : []
        }
        onOpenChange={handleOpenChange}
        open={open}
        disabled={disabled}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{ flex: 1 }}
        clearable={clearable}
      >
        {selectionOptions.map((option, index) =>
          showTooltip && option.props.tooltip ? (
            <Tooltip
              hideDelay={0}
              showDelay={0}
              key={option.props.value}
              content={option.props.tooltip}
              positioning="after"
              relationship={"description"}
            >
              {option}
            </Tooltip>
          ) : (
            <div key={option.props?.value ?? -1}>{option}</div>
          )
        )}
      </Combobox>
      {/* Attaching the tooltip directly onto combobox breaks it, so it is attached to a hidden element beside it instead.*/}
      <TooltipWrapper
        content={!open && showTooltip ? selectedOption?.tooltip ?? null : null}
        relationship="description"
        visible={visibleTooltip}
        child={<div></div>}
      />
    </div>
  );
};

export default ComboboxSearch;
