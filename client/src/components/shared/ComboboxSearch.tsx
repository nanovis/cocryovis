import type {
  OptionOnSelectData,
  SelectionEvents,
} from "@fluentui/react-components";
import { Combobox, useComboboxFilter } from "@fluentui/react-components";

import type { MouseEvent, KeyboardEvent, FocusEvent, ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import TooltipWrapper from "./TooltipWrapper";
import type { JSX } from "react/jsx-runtime";

export interface ComboboxOption {
  children: string;
  value: string;
  tooltip?: JSX.Element;
}

interface Props<T extends ComboboxOption> {
  selectionList: T[];
  selectedOption: T | undefined;
  onOptionSelect: (data: string | null) => void;
  placeholder: string;
  noOptionsMessage: string;
  optionToText?: (option: T) => string;
  renderOption?: (props: T) => JSX.Element;
  renderTooltipContent?: (props: T) => JSX.Element;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

const ComboboxSearch = <T extends ComboboxOption>({
  selectionList,
  selectedOption,
  onOptionSelect,
  placeholder,
  noOptionsMessage,
  optionToText = ({ children }) => children,
  renderOption,
  renderTooltipContent,
  className,
  disabled = false,
  clearable = false,
}: Props<T>) => {
  const [searchQuery, setSearchQuery] = useState(() =>
    selectedOption ? optionToText(selectedOption) : ""
  );

  const [open, setOpen] = useState(false);

  const [visibleTooltip, setVisibleTooltip] = useState(false);

  // Prevents on close effect from being executed after selecting an option
  const blockClosedRef = useRef(false);

  const optionToTextRef = useRef(optionToText);

  useEffect(() => {
    optionToTextRef.current = optionToText;
  }, [optionToText]);

  useEffect(() => {
    // eslint-disable-next-line @eslint-react/set-state-in-effect
    setSearchQuery(
      selectedOption ? optionToTextRef.current(selectedOption) : ""
    );
  }, [selectedOption]);

  const selectionOptions = useComboboxFilter(searchQuery, selectionList, {
    noOptionsMessage: noOptionsMessage,
    optionToText: optionToTextRef.current,
    renderOption: renderOption,
  });

  const handleOptionSelect = (
    _event: SelectionEvents,
    data: OptionOnSelectData
  ) => {
    if (!data.optionValue || data.optionValue.length === 0) {
      onOptionSelect(null);
      return;
    }
    onOptionSelect(data.optionValue);
    blockClosedRef.current = true;
  };

  const handleOpenChange = (
    _e:
      | MouseEvent<HTMLElement>
      | KeyboardEvent<HTMLElement>
      | FocusEvent<HTMLElement>,
    data: { open: boolean }
  ) => {
    setOpen(data.open);
    if (data.open && selectedOption) {
      setSearchQuery("");
    } else if (!data.open && !blockClosedRef.current && selectedOption) {
      setSearchQuery(optionToTextRef.current(selectedOption));
    }
    blockClosedRef.current = false;
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
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
        selectedOptions={selectedOption ? [selectedOption.value] : []}
        onOpenChange={handleOpenChange}
        open={open}
        disabled={disabled}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{ flex: 1 }}
        clearable={clearable}
      >
        {selectionOptions}
      </Combobox>
      {/* Attaching the tooltip directly onto combobox breaks it, so it is attached to a hidden element beside it instead.*/}
      <TooltipWrapper
        content={
          !open && selectedOption && renderTooltipContent
            ? renderTooltipContent(selectedOption)
            : null
        }
        relationship="description"
        visible={visibleTooltip}
        child={<div></div>}
      />
    </div>
  );
};

export default ComboboxSearch;
