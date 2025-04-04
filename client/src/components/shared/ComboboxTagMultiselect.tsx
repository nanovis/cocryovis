import {
  Button,
  Combobox,
  OptionOnSelectData,
  SelectionEvents,
  tokens,
  Tooltip,
  useComboboxFilter,
} from "@fluentui/react-components";
import { Dismiss12Regular } from "@fluentui/react-icons";

import { makeStyles } from "@fluentui/react-components";
import { useState } from "react";

const useStyles = makeStyles({
  multiselectContainer: {
    display: "flex",
    flexDirection: "column",
    justifyItems: "start",
    rowGap: "8px",
    border: `1px solid ${tokens.colorNeutralForeground3}`,
    padding: "12px",
    borderRadius: "4px",
    position: "relative",
  },
  tagsList: {
    listStyleType: "none",
    marginBottom: tokens.spacingVerticalXXS,
    marginTop: 0,
    paddingLeft: 0,
    display: "flex",
    minHeight: "25px",
    flexWrap: "wrap",
    gridGap: tokens.spacingHorizontalXXS,
  },
  topLeftTitle: {
    position: "absolute",
    top: "-13px",
    left: "10px",
    padding: "0px 8px",
    fontWeight: "bold",
    background: tokens.colorNeutralBackground1,
  },
});

interface Props<
  T extends { children: React.ReactNode | string; value: string },
> {
  selectionList: T[];
  textState: string[];
  selectedOptions: string[];
  onOptionSelect: (data: OptionOnSelectData | null) => void;
  onTagClick: (option: string, index: number) => void;
  title: string;
  placeholder: string;
  noOptionsMessage: string;
  optionToText?: (option: T) => string;
}

const ComboboxTagMultiselect = <
  T extends { children: React.ReactNode | string; value: string },
>({
  selectionList,
  textState,
  selectedOptions,
  onOptionSelect,
  onTagClick,
  title,
  placeholder,
  noOptionsMessage,
  optionToText = ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => children as string,
}: Props<T>) => {
  const classes = useStyles();

  const [searchQuery, setSearchQuery] = useState("");

  const handleOptionSelect = (
    event: SelectionEvents,
    data: OptionOnSelectData
  ) => {
    if (!data.optionValue) {
      setSearchQuery("");
      onOptionSelect(null);
      return;
    }
    onOptionSelect(data);
  };

  const handleTagClick = (option: string, index: number) => {
    const updatedselectedOptionsText = textState.slice();
    updatedselectedOptionsText.splice(index, 1);

    onTagClick(option, index);
  };

  const selectionOptions = useComboboxFilter(searchQuery, selectionList, {
    noOptionsMessage: noOptionsMessage,
    optionToText: optionToText,
  });

  return (
    <div className={classes.multiselectContainer}>
      <span className={classes.topLeftTitle}>{title}</span>
      <ul className={classes.tagsList}>
        {selectedOptions.map((volumeId, i) => (
          <li key={volumeId}>
            <Button
              size="small"
              shape="circular"
              appearance="primary"
              icon={<Dismiss12Regular />}
              iconPosition="after"
              onClick={() => handleTagClick(volumeId, i)}
              style={{ minWidth: 0 }}
            >
              {textState[i]}
            </Button>
          </li>
        ))}
      </ul>
      <Combobox
        multiselect={true}
        placeholder={placeholder}
        selectedOptions={selectedOptions}
        onOptionSelect={handleOptionSelect}
        value={searchQuery}
        onChange={(ev) => setSearchQuery(ev.target.value)}
        positioning={"after"}
      >
        {selectionOptions.map((option, index) =>
          option.props.tooltip ? (
            <Tooltip
              hideDelay={0}
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
    </div>
  );
};

export default ComboboxTagMultiselect;
