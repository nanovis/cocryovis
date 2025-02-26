import { useState } from "react";
import { Button, Label, mergeClasses } from "@fluentui/react-components";

import {
  Delete24Regular,
  ArrowDownload24Regular,
  ProjectionScreen24Regular,
} from "@fluentui/react-icons";

import { makeStyles, tokens, Tooltip } from "@fluentui/react-components";
import DeleteDialog from "./DeleteDialog";
import { WriteAccessTooltipContentWrapper } from "./WriteAccessTooltip";

const useStyles = makeStyles({
  container: {
    display: "flex",
    alignItems: "center",
    border: "solid 1px darkgray",
    background: tokens.colorNeutralBackground5,
    height: "42px",
  },
  inactive: {
    background: tokens.colorNeutralBackground4Hover,
  },
  actionButton: {
    width: "32px",
    height: "32px",
    minWidth: "32px",
    marginRight: "6px",
  },
  icon: {
    color: tokens.colorBrandForeground1,
  },
  disabledIcon: {
    opacity: 0.5,
    pointerEvents: "none",
  },
});

interface Props {
  title?: string | undefined;
  onDownload?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  onVisualize?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  onDelete?: (() => void) | undefined;
  deleteTitle?: string | undefined;
  deleteQuestion?: string | undefined;
  inactive?: boolean;
  preventChanges?: boolean;
}

const ItemTitleDownloadDelete = ({
  title = undefined,
  onDownload = undefined,
  onVisualize = undefined,
  onDelete = undefined,
  deleteTitle = undefined,
  deleteQuestion = undefined,
  inactive = false,
  preventChanges = false,
}: Props) => {
  const classes = useStyles();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDeleteClick = () => {
    if (!onDelete) return;
    onDelete();
    setIsDialogOpen(false);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  return (
    <div
      className={mergeClasses(classes.container, inactive && classes.inactive)}
    >
      <Label style={{ marginLeft: "20px" }}>{title?.substring(0, 50)}</Label>

      {(inactive || onDownload != null) && (
        <Tooltip content="Download" relationship="label" appearance="inverted">
          <Button
            size="large"
            appearance="subtle"
            className={classes.actionButton}
            style={{ marginLeft: "auto" }}
            disabled={inactive}
            onClick={onDownload}
            icon={
              <ArrowDownload24Regular
                className={mergeClasses(
                  classes.icon,
                  inactive && classes.disabledIcon
                )}
              />
            }
          ></Button>
        </Tooltip>
      )}

      {(inactive || onVisualize != null) && (
        <Tooltip content="Visualize" relationship="label" appearance="inverted">
          <Button
            size="large"
            appearance="subtle"
            className={classes.actionButton}
            disabled={inactive}
            onClick={onVisualize}
            icon={
              <ProjectionScreen24Regular
                className={mergeClasses(
                  classes.icon,
                  inactive && classes.disabledIcon
                )}
              />
            }
          ></Button>
        </Tooltip>
      )}

      {(inactive || onVisualize != null) && (
        <Tooltip
          content={
            <WriteAccessTooltipContentWrapper
              content={"Delete"}
              hasWriteAccess={!preventChanges}
            />
          }
          relationship="label"
          appearance="inverted"
        >
          <Button
            size="large"
            appearance="subtle"
            className={classes.actionButton}
            disabled={inactive || preventChanges}
            onClick={() => setIsDialogOpen(true)}
            icon={
              <Delete24Regular
                className={mergeClasses(
                  classes.icon,
                  (inactive || preventChanges) && classes.disabledIcon
                )}
              />
            }
          ></Button>
        </Tooltip>
      )}

      {/* Render the DeleteDialog */}
      <DeleteDialog
        TitleText={deleteTitle ?? ""}
        BodyText={deleteQuestion ?? ""}
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onConfirm={handleDeleteClick}
      />
    </div>
  );
};

export default ItemTitleDownloadDelete;
