import { Tooltip } from "@fluentui/react-components";

interface Props {
  content: JSX.Element | null;
  child: JSX.Element;
  hideDelay?: number;
  positioning?: import("@fluentui/react-components").PositioningShorthand;
  relationship?: "label" | "description" | "inaccessible";
  visible?: boolean;
}

const TooltipWrapper = ({
  content,
  child,
  hideDelay = 250,
  positioning = "after-top",
  relationship = "label",
  visible = undefined,
}: Props) => {
  return content ? (
    <Tooltip
      content={content}
      positioning={positioning}
      relationship={relationship}
      hideDelay={hideDelay}
      appearance="inverted"
      visible={visible}
    >
      {child}
    </Tooltip>
  ) : (
    child
  );
};

export default TooltipWrapper;
