import { useState } from "react";
import { Button, Label, mergeClasses } from "@fluentui/react-components";

import {
  Delete24Regular,
  ArrowDownload24Regular,
  ProjectionScreen24Regular,
  Edit24Regular,
} from "@fluentui/react-icons";

import { makeStyles, tokens, Tooltip } from "@fluentui/react-components";
import DeleteDialog from "./DeleteDialog";
import { WriteAccessTooltipContentWrapper } from "./WriteAccessTooltip";
import globalStyles from "../GlobalStyles";

const useStyles = makeStyles({
  container: {
    display: "flex",
    alignItems: "center",
    border: `solid 1px ${tokens.colorNeutralStrokeAccessibleHover}`,
    background: tokens.colorNeutralBackground5,
    height: "42px",
  },
  highlighted: {
    border: `solid 1px ${tokens.colorBrandForeground1}`,
    background: tokens.colorSubtleBackgroundHover,
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
});

interface Props {
  title?: string | undefined;
  onDownload?: React.MouseEventHandler<HTMLButtonElement>;
  onVisualize?: React.MouseEventHandler<HTMLButtonElement>;
  onDelete?: () => void;
  onEdit?: React.MouseEventHandler<HTMLButtonElement>;
  deleteTitle?: string | undefined;
  deleteQuestion?: string | undefined;
  inactive?: boolean;
  preventChanges?: boolean;
  highlighted?: boolean;
}

const ItemTitleDownloadDelete = ({
  title = undefined,
  onDownload = undefined,
  onVisualize = undefined,
  onDelete = undefined,
  onEdit = undefined,
  deleteTitle = undefined,
  deleteQuestion = undefined,
  inactive = false,
  preventChanges = false,
  highlighted = false,
}: Props) => {
  const classes = useStyles();
  const globalClasses = globalStyles();
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
      className={mergeClasses(
        classes.container,
        inactive && classes.inactive,
        !inactive && highlighted && classes.highlighted
      )}
    >
      <Label style={{ marginLeft: "20px" }}>{title?.substring(0, 50)}</Label>

      {(inactive || onEdit != undefined) && (
        <Tooltip content="Edit" relationship="label" appearance="inverted">
          <Button
            size="large"
            appearance="subtle"
            className={classes.actionButton}
            style={{ marginLeft: "auto" }}
            disabled={inactive}
            onClick={onEdit}
            icon={
              <Edit24Regular
                className={mergeClasses(
                  classes.icon,
                  inactive && globalClasses.disabledIcon
                )}
              />
            }
          ></Button>
        </Tooltip>
      )}

      {(inactive || onDownload != undefined) && (
        <Tooltip content="Download" relationship="label" appearance="inverted">
          <Button
            size="large"
            appearance="subtle"
            className={classes.actionButton}
            disabled={inactive}
            onClick={onDownload}
            icon={
              <ArrowDownload24Regular
                className={mergeClasses(
                  classes.icon,
                  inactive && globalClasses.disabledIcon
                )}
              />
            }
          ></Button>
        </Tooltip>
      )}

      {(inactive || onVisualize != undefined) && (
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
                  inactive && globalClasses.disabledIcon
                )}
              />
            }
          ></Button>
        </Tooltip>
      )}

      {(inactive || onDelete != undefined) && (
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
                  (inactive || preventChanges) && globalClasses.disabledIcon
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
