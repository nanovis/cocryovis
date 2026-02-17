import type {
  OptionOnSelectData,
  SelectionEvents,
} from "@fluentui/react-components";
import { Combobox, useComboboxFilter } from "@fluentui/react-components";

import { Tooltip } from "@fluentui/react-components";
import type {
  ReactNode,
  MouseEvent,
  KeyboardEvent,
  FocusEvent,
  ChangeEvent,
} from "react";
import { useEffect, useRef, useState } from "react";
import TooltipWrapper from "./TooltipWrapper";
import type { JSX } from "react/jsx-runtime";

interface Props<
  T extends {
    children: ReactNode | string;
    value: string;
    tooltip?: JSX.Element;
  },
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
    children: ReactNode | string;
    value: string;
    tooltip?: JSX.Element;
  },
>({
  selectionList,
  selectedOption,
  onOptionSelect,
  placeholder,
  noOptionsMessage,
  optionToText = ({ children }) => children as string,
  renderOption,
  className,
  showTooltip = true,
  disabled = false,
  clearable = false,
}: Props<T>) => {
  const [searchQuery, setSearchQuery] = useState(() =>
    selectedOption ? optionToText(selectedOption) : ""
  );

  const [open, setOpen] = useState(false);

  const [visibleTooltip, setVisibleTooltip] = useState(false);

  // Prevents on close effect from being executed after selecting an option
  const blockClosed = useRef(false);

  const optionToTextRef = useRef(optionToText);

  useEffect(() => {
    optionToTextRef.current = optionToText;
  }, [optionToText]);

  useEffect(() => {
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
    blockClosed.current = true;
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
    } else if (!data.open && !blockClosed.current && selectedOption) {
      setSearchQuery(optionToTextRef.current(selectedOption));
    }
    blockClosed.current = false;
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
        {selectionOptions.map((option) =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          showTooltip && option.props.tooltip ? (
            <Tooltip
              hideDelay={0}
              showDelay={0}
              /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
              key={option.props.value}
              /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
              content={option.props.tooltip}
              positioning="after"
              relationship={"description"}
            >
              {option}
            </Tooltip>
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            <div key={option.props?.value ?? -1}>{option}</div>
          )
        )}
      </Combobox>
      {/* Attaching the tooltip directly onto combobox breaks it, so it is attached to a hidden element beside it instead.*/}
      <TooltipWrapper
        content={
          !open && showTooltip ? (selectedOption?.tooltip ?? null) : null
        }
        relationship="description"
        visible={visibleTooltip}
        child={<div></div>}
      />
    </div>
  );
};

export default ComboboxSearch;
