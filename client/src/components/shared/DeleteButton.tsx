import {
  Button,
  mergeClasses,
  type ButtonProps,
} from "@fluentui/react-components";
import { Delete20Regular } from "@fluentui/react-icons";
import globalStyles from "../globalStyles";

type DeleteButtonProps = ButtonProps & { text: string };

const DeleteButton = (props: DeleteButtonProps) => {
  const globalClasses = globalStyles();
  return (
    <Button
      className={mergeClasses(
        globalClasses.actionButton,
        !props.disabled && globalClasses.actionButtonDelete
      )}
      {...props}
    >
      <div className={globalClasses.actionButtonIconContainer}>
        <Delete20Regular />
      </div>
      <div className="buttonText">{props.text}</div>
    </Button>
  );
};

export default DeleteButton;
