import type { MouseEventHandler, KeyboardEvent } from "react";
import { useState } from "react";
import { Button, Input, Label, mergeClasses } from "@fluentui/react-components";

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
import globalStyles from "../globalStyles";
import { observer } from "mobx-react-lite";

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
  hover: {
    padding: "4px 8px",
    borderRadius: "4px",

    ":hover": {
      backgroundColor: tokens.colorNeutralBackground2Hover,
      color: tokens.colorNeutralForeground1,
    },
  },
});

interface Props {
  title?: string | undefined;
  onDownload?: MouseEventHandler<HTMLButtonElement>;
  onVisualize?: MouseEventHandler<HTMLButtonElement>;
  onDelete?: () => Promise<void>;
  onEdit?: MouseEventHandler<HTMLButtonElement>;
  onColorChange?: (color: string) => void;
  onEnabled?: MouseEventHandler<HTMLButtonElement>;
  onEditVolumeData?: (newTitle: string) => Promise<void>;
  onStopEditVolumeData?: () => void;
  onStartEditVolumeData?: () => void;
  color?: string;
  isEnabled?: boolean;
  canChangeColor?: boolean;
  canEdit?: boolean;
  deleteTitle?: string | undefined;
  deleteQuestion?: string | undefined;
  inactive?: boolean;
  preventChanges?: boolean;
  highlighted?: boolean;
  isActive?: boolean;
  isEditVolumeData?: boolean;
}

const ItemTitleDownloadDelete = observer(
  ({
    title,
    onDownload,
    onVisualize,
    onDelete,
    onEdit,
    onColorChange,
    onEnabled,
    onStartEditVolumeData,
    onStopEditVolumeData,
    onEditVolumeData,
    isEditVolumeData = false,
    color,
    isEnabled = true,
    canChangeColor = false,
    canEdit = false,
    deleteTitle,
    deleteQuestion,
    inactive = false,
    preventChanges = false,
    highlighted = false,
    isActive = false,
  }: Props) => {
    const classes = useStyles();
    const globalClasses = globalStyles();
    const [colorValue, setColorValue] = useState("#ffffff");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [inputValue, setInputValue] = useState(title);
    const [isRenaming, setIsRenaming] = useState(false);

    const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
      if (!isEditVolumeData) {
        return;
      }
      if (e.key === "Enter") {
        if (onEditVolumeData && inputValue) {
          setIsRenaming(true);
          await onEditVolumeData(inputValue);
        }
        if (onStopEditVolumeData) {
          onStopEditVolumeData();
          setIsRenaming(false);
        }
      }

      if (e.key === "Escape") {
        setInputValue(title);
        if (onStopEditVolumeData) {
          onStopEditVolumeData();
        }
      }
    };

    const handleDeleteClick = async () => {
      if (!onDelete) return;
      await onDelete();
      if (!isActive) {
        setIsDialogOpen(false);
      }
    };
    const onDoubleClick = () => {
      if (!onStartEditVolumeData) {
        return;
      }
      setInputValue(title);
      onStartEditVolumeData();
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
          {isEditVolumeData ? (
            <>
              <Input
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                }}
                onKeyDown={(event) => {
                  handleKeyDown(event).catch(console.error);
                }}
                autoFocus
                disabled={isRenaming}
              />
            </>
          ) : (
            <div className={classes.hover} onDoubleClick={onDoubleClick}>
              <Label>{title?.substring(0, 50)}</Label>
            </div>
          )}

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
                        (inactive || preventChanges) &&
                          globalClasses.disabledIcon
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
            onConfirm={() => {
              handleDeleteClick().catch(console.error);
            }}
            isActive={isActive}
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
  }
);

export default ItemTitleDownloadDelete;
