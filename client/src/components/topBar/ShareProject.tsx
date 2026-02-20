import type { TagPickerOnOptionSelectData } from "@fluentui/react-components";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogSurface,
  DialogTrigger,
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableRow,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  DialogTitle,
  tokens,
  mergeClasses,
  Avatar,
  Text,
  Dropdown,
  Option,
  TableCellActions,
  Tooltip,
  Switch,
  Spinner,
} from "@fluentui/react-components";
import type { SyntheticEvent } from "react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as Utils from "../../utils/helpers";
import {
  bundleIcon,
  LinkRegular,
  PeopleSubtractFilled,
  PeopleSubtractRegular,
} from "@fluentui/react-icons";
import { observer } from "mobx-react-lite";
import { useMst } from "@/stores/RootStore";
import type { UserDB } from "@/stores/userState/UserModel";
import { getAllUsers } from "@/api/users";
import { getAccessInfo, setAccess } from "@/api/projects";
import ToastContainer from "../../utils/toastContainer";

const useStyles = makeStyles({
  userSelection: {
    flex: 1,
    "&>span": {
      gridTemplateRows: "auto",
    },
  },
  scrollbar: {
    overflowY: "auto",
    borderTop: "1px solid transparent",
    borderBottom: "1px solid transparent",

    "&.scrolled": {
      borderTopColor: tokens.colorNeutralForeground2,
    },
    "&.bottom-highlighted": {
      borderBottomColor: tokens.colorNeutralForeground2,
    },
  },
  table: {
    "& tr": {
      border: "none",
    },
    "& td": {
      paddingTop: "4px",
      paddingBottom: "4px",
    },
  },
  userAccessLevelDropdown: {
    minWidth: "112px",
    border: 0,
    backgroundColor: tokens.colorTransparentBackground,
    "&>button": {
      padding: "2px",
    },
  },
  listbox: {
    minWidth: "220px",
  },
});

enum AccessLevel {
  ReadOnly = 0,
  ReadWrite = 1,
  Remove = -1,
}

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ShareProject = observer(({ open, setOpen }: Props) => {
  const { user } = useMst();

  const activeProject = user.userProjects.activeProject;

  const classes = useStyles();
  const RemoveSharingIcon = bundleIcon(
    PeopleSubtractFilled,
    PeopleSubtractRegular
  );

  const [query, setQuery] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [accessLevel, setAccessLevel] = useState("Read & Write");

  const [users, setUsers] = useState<UserDB[]>([]);

  const [accessMap, setAccessMap] = useState<Map<number, number>>(
    () => new Map()
  );

  const [publicAccess, setPublicAccess] = useState(activeProject?.publicAccess);

  const [isFetchingData, setIsFetchingData] = useState(false);

  const [isModifyingAccess, setIsModifyingAccess] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [isScrolled, setIsScrolled] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const [pendingChanges, setPendingChanges] = useState<Map<number, number>>(
    () => new Map()
  );

  const [isHoveringOverTagPicker, setIsHoveringOverTagPicker] = useState(false);

  const pageBusy = isFetchingData || isModifyingAccess;

  const canSetSharing = !user.isGuest && user.id === activeProject?.ownerId;

  const usersWithAccess = useMemo(() => {
    return users
      .filter(
        (u) =>
          accessMap.has(u.id) &&
          accessMap.get(u.id) !== AccessLevel.Remove &&
          pendingChanges.get(u.id) !== AccessLevel.Remove
      )
      .map((u) => {
        const pending = pendingChanges.get(u.id);
        return {
          user: u,
          accessLevel: pending ?? accessMap.get(u.id),
          changed: pending !== undefined,
        };
      })
      .filter((u) => u.accessLevel !== AccessLevel.Remove);
  }, [users, accessMap, pendingChanges]);

  const tagPickerOptions = useMemo(() => {
    return users.filter(
      (u) =>
        !accessMap.has(u.id) &&
        u.id !== user.id &&
        !selectedIds.includes(u.id.toString()) &&
        (u.username.toLowerCase().includes(query.toLowerCase()) ||
          u.name.toLowerCase().includes(query.toLowerCase()))
    );
  }, [users, accessMap, selectedIds, query, user.id]);

  const selectedOptions = useMemo(
    () => users.filter((u) => selectedIds.includes(String(u.id))),
    [users, selectedIds]
  );

  const handleScroll = () => {
    const element = scrollRef.current;
    if (element) {
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;

      setIsScrolled(scrollTop > 0);

      setIsAtBottom(scrollTop + clientHeight >= scrollHeight);
    }
  };

  useEffect(() => {
    if (!open || !activeProject) return;

    const fetch = async () => {
      const toast = new ToastContainer();
      try {
        setIsFetchingData(true);

        const [allUsers, accessInfo] = await Promise.all([
          getAllUsers(),
          getAccessInfo(activeProject.id),
        ]);

        setUsers(allUsers);
        setAccessMap(
          new Map(accessInfo.userAccess.map((u) => [u.userId, u.accessLevel]))
        );

        activeProject.setPublicAccess(accessInfo.projectAccess.publicAccess);
        setPublicAccess(accessInfo.projectAccess.publicAccess);
      } catch (e) {
        setOpen(false);
        toast.error(
          Utils.getErrorMessage(e) || "Failed to fetch project access data."
        );
      } finally {
        setIsFetchingData(false);
      }
    };

    fetch().catch(console.error);
  }, [open, activeProject, setOpen]);

  useEffect(() => {
    handleScroll();
  }, [usersWithAccess]);

  const onOptionSelect = useCallback(
    (_ev: Event | SyntheticEvent, data: TagPickerOnOptionSelectData) => {
      setQuery("");

      if (data.value === "no-options") {
        return;
      }

      setSelectedIds(data.selectedOptions);
    },
    []
  );

  const onConfirmChanges = async () => {
    const toastContainer = new ToastContainer();
    try {
      if (pageBusy || !activeProject || publicAccess === undefined) {
        return;
      }

      toastContainer.loading("Modifying access...");

      if (
        pendingChanges.size === 0 &&
        selectedIds.length === 0 &&
        publicAccess === activeProject.publicAccess
      ) {
        throw new Error("No changes to apply.");
      }

      setIsModifyingAccess(true);

      let changes;

      if (selectedIds.length > 0) {
        const level =
          accessLevel === "Read & Write"
            ? AccessLevel.ReadWrite
            : AccessLevel.ReadOnly;
        changes = selectedIds.map((id) => ({
          userId: Number(id),
          accessLevel: level,
        }));
      } else {
        changes = Array.from(pendingChanges, ([userId, accessLevel]) => ({
          userId: userId,
          accessLevel: accessLevel,
        }));
      }
      const accessInfoChanges = await setAccess(activeProject.id, {
        userAccess: changes,
        publicAccess: publicAccess,
      });

      resetChanges();

      setAccessMap(
        new Map(
          accessInfoChanges.userAccess.map((u) => [u.userId, u.accessLevel])
        )
      );

      activeProject.setPublicAccess(accessInfoChanges.publicAccess);
      setPublicAccess(activeProject.publicAccess);

      toastContainer.success("Access modified successfully!");
    } catch (error) {
      toastContainer.error(Utils.getErrorMessage(error));
      console.error(error);
    } finally {
      setIsModifyingAccess(false);
    }
  };

  const handleOnRemoveAccess = (userId: number) => {
    setPendingChanges((prev) => {
      const newPendingChanges = new Map(prev);
      newPendingChanges.set(userId, -1);
      return newPendingChanges;
    });
  };

  const resetChanges = () => {
    if (pendingChanges.size > 0) {
      setPendingChanges(new Map());
    }
    if (selectedIds.length > 0) {
      setSelectedIds([]);
    }
    setPublicAccess(activeProject?.publicAccess);
  };

  const setUserAccessLevel = useCallback(
    (userId: number, accessLevel: number) => {
      if (accessMap.get(userId) === accessLevel) {
        setPendingChanges((prev) => {
          const newPendingChanges = new Map(prev);
          newPendingChanges.delete(userId);
          return newPendingChanges;
        });
        return;
      }

      setPendingChanges((prev) => {
        const newPendingChanges = new Map(prev);
        newPendingChanges.set(userId, accessLevel);
        return newPendingChanges;
      });
    },
    [accessMap]
  );

  return (
    <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <DialogSurface>
        <DialogTitle style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: "32px",
            }}
          >
            Share project "{activeProject?.name}"
            {pageBusy && <Spinner delay={200} />}
          </div>
        </DialogTitle>
        <DialogBody
          style={{
            minHeight: "300px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", columnGap: "20px" }}>
                <TagPicker
                  onOptionSelect={onOptionSelect}
                  selectedOptions={selectedIds}
                  positioning={{
                    autoSize: true,
                    position: "below",
                    align: "start",
                    pinned: true,
                  }}
                  size="large"
                  disabled={
                    pendingChanges.size > 0 || pageBusy || !canSetSharing
                  }
                >
                  <TagPickerControl
                    className={classes.userSelection}
                    onMouseEnter={() => setIsHoveringOverTagPicker(true)}
                    onMouseLeave={() => setIsHoveringOverTagPicker(false)}
                  >
                    <TagPickerGroup aria-label="Users">
                      {selectedOptions.map((option) => (
                        <Tag
                          key={option.id}
                          shape="circular"
                          value={option.id.toString()}
                          appearance="outline"
                          media={
                            <Avatar
                              name={option.name}
                              color="colorful"
                              shape="circular"
                            />
                          }
                        >
                          {option.username}
                        </Tag>
                      ))}
                    </TagPickerGroup>
                    <TagPickerInput
                      placeholder="Select users"
                      aria-label="Users"
                      value={query}
                      style={{ marginLeft: "5px", minWidth: "100%" }}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </TagPickerControl>
                  <TagPickerList
                    multiselect={true}
                    style={{ overflowY: "auto", maxHeight: "10px" }}
                  >
                    {tagPickerOptions.length > 0 ? (
                      tagPickerOptions.map((option) => (
                        <TagPickerOption
                          value={option.id.toString()}
                          key={option.id}
                          media={<Avatar name={option.name} color="colorful" />}
                          text={option.username}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              justifyItems: "center",
                              lineHeight: "18px",
                              marginLeft: "6px",
                            }}
                          >
                            <Text truncate={true} weight="semibold">
                              {option.username}
                            </Text>
                            <Text truncate={true}>{option.name}</Text>
                          </div>
                        </TagPickerOption>
                      ))
                    ) : (
                      <TagPickerOption value="no-options">
                        No options available
                      </TagPickerOption>
                    )}
                  </TagPickerList>
                </TagPicker>
                {selectedIds.length > 0 && (
                  <Dropdown
                    value={accessLevel}
                    onOptionSelect={(_e, data) =>
                      setAccessLevel(data.optionText ?? "Read & Write")
                    }
                    style={{ height: "42px", minWidth: "150px" }}
                    listbox={{
                      className: classes.listbox,
                    }}
                  >
                    <Option
                      checkIcon={<></>}
                      text="Read & Write"
                      value={"write"}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <Text weight="semibold">Read & Write</Text>
                        <Text size={200}>
                          User can add, edit, remove and download project data
                          and use it for inference and training.
                        </Text>
                      </div>
                    </Option>
                    <Option checkIcon={<></>} text="Read Only" value={"read"}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <Text weight="semibold">Read Only</Text>
                        <Text size={200}>
                          User can download project data and use it for
                          inference and training.
                        </Text>
                      </div>
                    </Option>
                  </Dropdown>
                )}
              </div>
              <Tooltip
                content={"Resolve pending changes first!"}
                relationship={"label"}
                visible={pendingChanges.size > 0 && isHoveringOverTagPicker}
                positioning="below"
              >
                <div></div>
              </Tooltip>
              <Tooltip
                content={
                  "Only owner of the project can set access permissions."
                }
                relationship={"label"}
                visible={!canSetSharing && isHoveringOverTagPicker}
                positioning="below"
              >
                <div></div>
              </Tooltip>
            </div>
            {selectedIds.length === 0 && usersWithAccess.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginTop: "15px",
                }}
              >
                <Text size={400}>Users with access</Text>
                <div
                  style={{
                    maxHeight: "178px",
                  }}
                  className={mergeClasses(
                    classes.scrollbar,
                    "scrollbarStyle",
                    isScrolled && "scrolled",
                    !isAtBottom && "bottom-highlighted"
                  )}
                  onScroll={handleScroll}
                  ref={scrollRef}
                >
                  <Table
                    arial-label="Default table"
                    style={{
                      minWidth: "100%",
                    }}
                    className={classes.table}
                  >
                    <TableBody>
                      {usersWithAccess.map(({ user, accessLevel, changed }) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <TableCellLayout
                              media={
                                <Avatar
                                  aria-label={user.name}
                                  name={user.name}
                                  color="colorful"
                                />
                              }
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyItems: "center",
                                  lineHeight: "18px",
                                }}
                              >
                                <Text truncate={true} weight="semibold">
                                  {user.username}
                                </Text>
                                <Text truncate={true}>{user.name}</Text>
                              </div>
                            </TableCellLayout>
                          </TableCell>
                          <TableCell style={{ width: "120px" }}>
                            <TableCellLayout>
                              <Dropdown
                                className={classes.userAccessLevelDropdown}
                                button={
                                  <Text
                                    style={{
                                      color: changed
                                        ? tokens.colorNeutralForeground1
                                        : tokens.colorNeutralForeground3,
                                    }}
                                  >
                                    {accessLevel === AccessLevel.ReadWrite
                                      ? "Read & Write"
                                      : "Read Only"}
                                  </Text>
                                }
                                onOptionSelect={(_e, data) =>
                                  setUserAccessLevel(
                                    user.id,
                                    data.optionText === "Read & Write"
                                      ? AccessLevel.ReadWrite
                                      : AccessLevel.ReadOnly
                                  )
                                }
                                disabled={!canSetSharing || pageBusy}
                              >
                                <Option checkIcon={<></>} value="Read & Write">
                                  Read & Write
                                </Option>
                                <Option checkIcon={<></>} value="Read Only">
                                  Read Only
                                </Option>
                              </Dropdown>
                            </TableCellLayout>
                          </TableCell>
                          <TableCell style={{ width: "50px" }}>
                            <TableCellActions>
                              <Button
                                icon={<RemoveSharingIcon />}
                                appearance="transparent"
                                aria-label="Edit"
                                size="large"
                                style={{ marginRight: "10px" }}
                                onClick={() => handleOnRemoveAccess(user.id)}
                                disabled={!canSetSharing || pageBusy}
                              />
                            </TableCellActions>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "15px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Text size={400}>Link sharing</Text>
              <Text style={{ color: tokens.colorNeutralForeground4 }}>
                Anyone with the link can view and download the data.
              </Text>
            </div>
            <Switch
              checked={publicAccess === 1}
              onChange={(_, data) => {
                setPublicAccess(data.checked ? 1 : 0);
              }}
            />
          </div>
          <DialogActions style={{ marginTop: "15px", alignItems: "center" }}>
            {pendingChanges.size > 0 ? (
              <Text
                align="center"
                italic={true}
                weight="semibold"
                style={{ color: tokens.colorNeutralForeground3 }}
              >
                Changes Pending
              </Text>
            ) : (
              <Button
                disabled={pageBusy}
                onClick={async () => {
                  if (!activeProject) {
                    return;
                  }
                  try {
                    await navigator.clipboard.writeText(
                      activeProject.getProjectUrl()
                    );
                  } catch (error) {
                    console.error("Failed to copy link: ", error);
                  }
                }}
                appearance="secondary"
                icon={<LinkRegular />}
              >
                Copy Link
              </Button>
            )}
            <div style={{ marginLeft: "auto" }}>
              {pendingChanges.size > 0 ||
              selectedIds.length > 0 ||
              publicAccess !== activeProject?.publicAccess ? (
                <>
                  <Button
                    disabled={pageBusy}
                    onClick={resetChanges}
                    appearance="secondary"
                  >
                    Discard
                  </Button>
                  <Button
                    appearance="primary"
                    disabled={pageBusy || !canSetSharing}
                    onClick={() => {
                      onConfirmChanges().catch(console.error);
                    }}
                    style={{ marginLeft: "20px" }}
                  >
                    Confirm
                  </Button>
                </>
              ) : (
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary">Close</Button>
                </DialogTrigger>
              )}
            </div>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
});

export default ShareProject;
