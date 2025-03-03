import {
  Button,
  makeStyles,
  mergeClasses,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { FluentIcon } from "@fluentui/react-icons";

const useStyles = makeStyles({
  widgetButton: {
    ":hover:active:not(:disabled)": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ":hover:active:not(:disabled) .fui-Button__icon": {
      color: tokens.colorBrandForeground1,
    },
  },
  widgetButtonSelected: {
    backgroundColor: tokens.colorNeutralBackground1Hover,
  },
  iconSelected: {
    color: tokens.colorBrandForeground1,
  },
});

interface Props {
  title: string;
  labelPositioning: "before" | "after";
  LabelIcon: FluentIcon;
  isOpen: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const WidgetToggleButton = ({
  title,
  labelPositioning,
  LabelIcon,
  isOpen,
  onClick,
  disabled,
}: Props) => {
  const classes = useStyles();

  return (
    <Tooltip
      content={title}
      relationship="label"
      appearance="inverted"
      positioning={labelPositioning}
      showDelay={0}
      hideDelay={0}
      withArrow={true}
    >
      <Button
        appearance="subtle"
        size="large"
        className={mergeClasses(
          classes.widgetButton,
          isOpen && classes.widgetButtonSelected
        )}
        icon={
          <LabelIcon className={mergeClasses(isOpen && classes.iconSelected)} />
        }
        onClick={onClick}
        disabled={disabled}
      />
    </Tooltip>
  );
};

export default WidgetToggleButton;
