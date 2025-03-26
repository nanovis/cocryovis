import { makeStyles, tokens } from "@fluentui/react-components";

const globalStyles = makeStyles({
  leftSidebar: {
    width: "580px",
    borderRight: `2px solid ${tokens.colorNeutralBackground1Hover}`,
    position: "absolute",
    height: "100%", //"93vh", // Set height to 100% of the viewport height
    left: "52px",
    backgroundColor: tokens.colorNeutralBackground1,
    overflowY: "auto", // Add overflow-y to enable scrolling if content overflows
  },
  rightSidebar: {
    width: "420px",
    borderLeft: `2px solid ${tokens.colorNeutralBackground1Hover}`,
    position: "absolute",
    height: "100%",
    right: "52px",
    backgroundColor: tokens.colorNeutralBackground1,
    overflowY: "auto",
  },
  sidebarContents: {
    display: "flex",
    flexDirection: "column",
    paddingLeft: "24px",
    paddingTop: "8px",
    paddingRight: "24px",
    justifyContent: "center",
  },
  sidebarHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "8px",
    marginBottom: "12px",
  },
  siderbarBody: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    justifyItems: "center",
  },
  closeSidebarIconContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    paddingTop: "8px",
    paddingBottom: "8px",
    paddingRight: "8px",
    paddingLeft: "8px",
    borderRadius: "10px",
    ":hover": {
      cursor: "pointer",
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  closeSidebarIcon: {
    color: tokens.colorBrandForeground1,
  },
  hiddenInput: {
    display: "none",
  },
  sectionTitle: {
    marginBottom: 0,
  },
  subSectionTitle: {
    marginTop: "8px",
    marginBottom: 0,
  },
  drowdownActionsContainer: {
    display: "flex",
    flexDirection: "row",
  },
  selectionDropdown: {
    flex: 1,
  },
  selectionDropdownTooltip: {
    minHeight: "20px",
    alignContent: "center",
  },

  //Buttons
  mainActionButton: {
    "&:hover:enabled": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    "& svg": {
      color: tokens.colorBrandForeground1,
    },
    "&:disabled svg": {
      opacity: 0.5,
      pointerEvents: "none",
    },
  },
  sideActionButton: {
    marginLeft: "10px",
    "&:hover:enabled": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    "& svg": {
      color: tokens.colorBrandForeground1,
    },
    "&:disabled svg": {
      opacity: 0.5,
      pointerEvents: "none",
    },
  },
  actionButtonRow: {
    display: "flex",
    justifyContent: "flex-start",
    columnGap: "16px",
  },
  actionButton: {
    height: "32px",
    padding: 0,
    justifyContent: "space-between",
    "& > .buttonText": {
      margin: "auto",
      paddingLeft: "13px",
      paddingRight: "13px",
    },
    "&:disabled": {
      border: 0,
    },
  },
  buttonDetails: {
    minWidth: "5px",
    "& span": {
      paddingRight: "4px",
    },
  },
  buttonDetailsIconContainer: {
    paddingLeft: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  elementDetails: {
    padding: "10px",
  },
  actionButtonDelete: {
    border: 0,
    background: tokens.colorStatusDangerBackground2,
    "&:disabled": {
      background: tokens.colorNeutralBackgroundDisabled,
    },
    "&:enabled:hover": {
      background: tokens.colorStatusDangerBackground3Hover,
    },
    "&:enabled:hover:active": {
      background: tokens.colorStatusDangerBackground3Pressed,
    },
  },
  actionButtonDropdown: {
    height: "32px",
    padding: 0,
    border: 0,
    "& > span": {
      marginRight: "auto",
      paddingRight: "8px",
    },
    "& > .buttonText": {
      paddingLeft: "8px",
      paddingRight: "3px",
      marginLeft: "auto",
    },
  },
  actionButtonIconContainer: {
    background: "rgba(0,0,0,0.15)",
    marginLeft: "0",
    marginRight: "0",
    paddingLeft: "5.5px",
    paddingRight: "5.5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  successIcon: {
    color: tokens.colorBrandForeground1,
    verticalAlign: "middle",
  },
  warningIcon: {
    color: tokens.colorPaletteMarigoldForeground3,
    verticalAlign: "middle",
  },
  failIcon: {
    color: tokens.colorPaletteRedBackground3,
    verticalAlign: "middle",
  },
  disabledIcon: {
    opacity: 0.5,
    pointerEvents: "none",
  },
  widgetButtonContainer: {
    display: "flex",
    flexDirection: "column",
    rowGap: "14px",
    alignItems: "center",
    height: "100%",
  },
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
  sidebar: {
    minWidth: "50px",
    display: "flex",
    flexDirection: "column",
    paddingTop: "16px",
    overflowY: "auto",
  },
});

export default globalStyles;
