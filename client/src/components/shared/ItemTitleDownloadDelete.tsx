import { useState } from "react";
import { Button, Label, mergeClasses } from "@fluentui/react-components";

import {
  Delete24Regular,
  ArrowDownload24Regular,
  ProjectionScreen24Regular,
  Edit24Regular,
  Eye24Regular,
  EyeOff24Regular,
} from "@fluentui/react-icons";

import { makeStyles, tokens, Tooltip } from "@fluentui/react-components";
import DeleteDialog from "./DeleteDialog";
import { WriteAccessTooltipContentWrapper } from "./WriteAccessTooltip";
import globalStyles from "../GlobalStyles";

const useStyles = makeStyles({
  container: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexGrow: 1,
    border: `solid 1px ${tokens.colorNeutralStrokeAccessibleHover}`,
    background: tokens.colorNeutralBackground5,
    height: "42px",
    paddingRight: "6px",
    paddingLeft: "18px",
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
    "&.fui-Button__icon": {
      color: tokens.colorBrandForeground1,
    },
    ":disabled &.fui-Button__icon": {
      opacity: 0.5,
      pointerEvents: "none",
    },
  },
  icon: {
    color: tokens.colorBrandForeground1,
    ":disabled": {
      opacity: 0.5,
      pointerEvents: "none",
    },
  },
  colorPicker: {
    marginTop: "0px",
    width: "40px",
    height: "45px",
    border: "none",
    cursor: "pointer",
    background: "none",
    padding: 0,
    ":disabled": {
      cursor: "not-allowed",
    },
  },
});

interface Props {
  title?: string | undefined;
  onDownload?: React.MouseEventHandler<HTMLButtonElement>;
  onVisualize?: React.MouseEventHandler<HTMLButtonElement>;
  onDelete?: () => void;
  onEdit?: React.MouseEventHandler<HTMLButtonElement>;
  onColorChange?: (color: string) => void;
  onEnabled?: React.MouseEventHandler<HTMLButtonElement>;
  color?: string;
  isEnabled?: boolean;
  canChangeColor?: boolean;
  canEdit?: boolean;
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
  onColorChange = undefined,
  onEnabled = undefined,
  color = undefined,
  isEnabled = true,
  canChangeColor = false,
  canEdit = false,
  deleteTitle = undefined,
  deleteQuestion = undefined,
  inactive = false,
  preventChanges = false,
  highlighted = false,
}: Props) => {
  const classes = useStyles();
  const globalClasses = globalStyles();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [colorValue, setColorValue] = useState("#ffffff");

  const handleDeleteClick = () => {
    if (!onDelete) return;
    onDelete();
    setIsDialogOpen(false);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  return (
    <div style={{ display: "flex", flex: "1", gap: "12px" }}>
      <div
        className={mergeClasses(
          classes.container,
          inactive && classes.inactive,
          highlighted && classes.highlighted
        )}
      >
        <Label>{title?.substring(0, 50)}</Label>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "6px",
          }}
        >
          {onEdit != undefined && (
            <Tooltip
              content="Edit"
              relationship="label"
              appearance="inverted"
              positioning={"before"}
            >
              <Button
                size="large"
                appearance="subtle"
                className={classes.actionButton}
                disabled={!canEdit}
                onClick={onEdit}
                icon={
                  <Edit24Regular
                    className={mergeClasses(
                      classes.icon,
                      !canEdit && globalClasses.disabledIcon
                    )}
                  />
                }
              />
            </Tooltip>
          )}

          {(inactive || onDownload != undefined) && (
            <Tooltip
              content="Download"
              relationship="label"
              appearance="inverted"
            >
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
              />
            </Tooltip>
          )}

          {(inactive || onVisualize != undefined) && (
            <Tooltip
              content="Visualize"
              relationship="label"
              appearance="inverted"
            >
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
              />
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
              />
            </Tooltip>
          )}
        </div>

        {/* Render the DeleteDialog */}
        <DeleteDialog
          TitleText={deleteTitle ?? ""}
          BodyText={deleteQuestion ?? ""}
          open={isDialogOpen}
          onClose={handleCloseDialog}
          onConfirm={handleDeleteClick}
        />
      </div>
      {onColorChange != undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <input
            className={classes.colorPicker}
            type="color"
            disabled={!canChangeColor}
            value={color ?? "#ffffff"}
            onChange={(event) => setColorValue(event.target.value)}
            onBlur={() => onColorChange(colorValue)}
          />
          <Button
            size="large"
            appearance="subtle"
            className={globalClasses.mainActionButton}
            disabled={!canChangeColor}
            onClick={onEnabled}
            icon={
              isEnabled ? (
                <Eye24Regular className={classes.icon} />
              ) : (
                <EyeOff24Regular className={classes.icon} />
              )
            }
          />
        </div>
      )}
    </div>
  );
};

export default ItemTitleDownloadDelete;
