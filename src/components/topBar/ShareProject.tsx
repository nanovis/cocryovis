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
  TagPickerOnOptionSelectData,
} from "@fluentui/react-components";
import { useState, useEffect, useRef, SyntheticEvent } from "react";
import Utils from "../../functions/Utils";
import {
  bundleIcon,
  PeopleSubtractFilled,
  PeopleSubtractRegular,
} from "@fluentui/react-icons";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";
import { UserDB } from "../../stores/userState/UserModel";

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

interface accessInfo {
  userId: number;
  accessLevel: number;
}

interface accessInfoChanges {
  updated: accessInfo[];
  deleted: accessInfo[];
}

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const ShareProject = observer(({ open, setOpen }: Props) => {
  const { user } = useMst();

  const activeProjectId = user?.userProjects.activeProjectId;
  const activeProject = user?.userProjects.activeProject;

  const classes = useStyles();
  const RemoveSharingIcon = bundleIcon(
    PeopleSubtractFilled,
    PeopleSubtractRegular
  );

  const [query, setQuery] = useState("");

  const [selectedOptions, setSelectedOptions] = useState<UserDB[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [accessLevel, setAccessLevel] = useState("Read & Write");

  const users = useRef<UserDB[]>([]);

  const accessInfoMap = useRef(new Map());

  const [usersWithAccess, setUsersWithAccess] = useState<
    { user: UserDB; accessLevel: number; changed: boolean }[]
  >([]);

  const [tagPickerOptions, setTagPickerOptions] = useState<UserDB[]>([]);

  const [isFetchingData, setIsFetchingData] = useState(false);

  const [isGrantingAccess, setIsGrantingAccess] = useState(false);

  const pageBusy = () => {
    return isFetchingData || isGrantingAccess;
  };

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [isScrolled, setIsScrolled] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const [pendingChanges, setPendingChanges] = useState(new Map());

  const [isHoveringOverTagPicker, setIsHoveringOverTagPicker] = useState(false);

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

  const fetchUserData = async () => {
    try {
      if (!activeProjectId) {
        return;
      }

      setIsFetchingData(true);

      let response = await Utils.sendReq("users", {
        method: "GET",
      });

      const allUsers = await response.json();

      response = await Utils.sendReq(`project/${activeProjectId}/access`, {
        method: "GET",
      });

      const accessInfo: { userId: number; accessLevel: number }[] =
        await response.json();

      users.current = allUsers;

      const accessMap = new Map(
        accessInfo.map(({ userId, accessLevel }) => [userId, accessLevel])
      );
      accessInfoMap.current = accessMap;

      refreshUsersWithAccess();
      refreshTagPickerOptions();
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetchingData(false);
    }
  };

  useEffect(() => {
    if (open) {
      refreshUsersWithAccess();
    }
  }, [pendingChanges]);

  useEffect(() => {
    if (open && user) {
      refreshTagPickerOptions();
    }
  }, [selectedIds, user?.id, query]);

  const refreshUsersWithAccess = () => {
    setUsersWithAccess(
      users.current
        ?.filter(
          (userData) =>
            accessInfoMap.current?.get(userData.id) >= -1 &&
            pendingChanges.get(userData.id) !== -1
        )
        .map((userData) => {
          const pendingChange = pendingChanges.get(userData.id);
          return {
            user: userData,
            accessLevel:
              pendingChange ?? accessInfoMap.current?.get(userData.id),
            changed: pendingChange >= 0,
          };
        })
    );
  };

  const refreshTagPickerOptions = () => {
    setTagPickerOptions(
      users.current?.filter(
        (userData) =>
          !accessInfoMap.current?.get(userData.id) &&
          !selectedIds.includes(userData.id.toString()) &&
          user?.id !== userData.id &&
          (userData.name.toLowerCase().includes(query.toLowerCase()) ||
            userData.username.toLowerCase().includes(query.toLowerCase()))
      )
    );
  };

  useEffect(() => {
    if (open) {
      fetchUserData();
    } else {
      setPendingChanges(new Map());
      setUsersWithAccess([]);
      setPendingChanges(new Map());
      setSelectedIds([]);
    }
  }, [open]);

  useEffect(() => {
    handleScroll();
  }, [usersWithAccess]);

  const onOptionSelect = (
    ev: Event | SyntheticEvent<Element, Event>,
    data: TagPickerOnOptionSelectData
  ) => {
    setQuery("");

    if (data.value === "no-options") {
      return;
    }

    setSelectedIds(data.selectedOptions);
    setSelectedOptions(
      users.current.filter((option) =>
        data.selectedOptions.includes(option.id.toString())
      )
    );
  };

  const onConfirmChanges = async () => {
    if (selectedIds.length > 0) {
      await onAccessGranted();
    } else {
      await onAccessChanged();
    }
  };

  const onAccessGranted = async () => {
    try {
      if (pageBusy() || !activeProjectId) {
        return;
      }

      setIsGrantingAccess(true);

      const selection = selectedIds.filter(
        (id) => !accessInfoMap.current?.get(Number(id))
      );

      if (selection.length === 0) {
        return;
      }

      const level = accessLevel === "Read & Write" ? 1 : 0;

      const response = await Utils.sendRequestWithToast(
        `project/${activeProjectId}/access`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            selectedIds.map((id) => ({
              userId: Number(id),
              accessLevel: level,
            }))
          ),
        },
        { successText: "Access granted successfully!" }
      );
      const accessInfoChanges = await response.json();

      setSelectedIds([]);

      updateAccessInfoMap(accessInfoChanges);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGrantingAccess(false);
    }
  };

  const onAccessChanged = async () => {
    try {
      if (pageBusy() || pendingChanges.size < 1 || !activeProjectId) {
        return;
      }

      setIsGrantingAccess(true);

      const changes = Array.from(pendingChanges, ([userId, accessLevel]) => ({
        userId: userId,
        accessLevel: accessLevel,
      }));

      const response = await Utils.sendRequestWithToast(
        `project/${activeProjectId}/access`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        },
        { successText: "Access modified successfully!" }
      );
      const accessInfoChanges: accessInfoChanges = await response.json();

      setPendingChanges(new Map());

      updateAccessInfoMap(accessInfoChanges);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGrantingAccess(false);
    }
  };

  const updateAccessInfoMap = (accessInfoChanges: accessInfoChanges) => {
    accessInfoChanges.updated.forEach((info) => {
      accessInfoMap.current.set(info.userId, info.accessLevel);
    });
    accessInfoChanges.deleted.forEach((info) => {
      accessInfoMap.current.delete(info.userId);
    });

    refreshUsersWithAccess();
    refreshTagPickerOptions();
  };

  const handleOnRemoveAccess = (userId: number) => {
    setPendingChanges((prev) => {
      const newPendingChanges = new Map(prev);
      newPendingChanges.set(userId, -1);
      return newPendingChanges;
    });
  };

  const discardChanges = () => {
    if (pendingChanges.size > 0) {
      setPendingChanges(new Map());
    }
    if (selectedIds.length > 0) {
      setSelectedIds([]);
    }
  };

  const setUserAccessLevel = (userId: number, accessLevel: number) => {
    if (accessInfoMap.current.get(userId) === accessLevel) {
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
  };

  return (
    <Dialog open={open} onOpenChange={(event, data) => setOpen(data.open)}>
      <DialogSurface>
        <DialogTitle style={{ marginBottom: "20px" }}>
          Share project "{activeProject?.name}"
        </DialogTitle>
        <DialogBody
          style={{
            minHeight: "300px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
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
                disabled={pendingChanges.size > 0 || pageBusy()}
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
                  onOptionSelect={(e, data) =>
                    setAccessLevel(data.optionText ?? "Read & Write")
                  }
                  style={{ height: "42px", minWidth: "150px" }}
                  listbox={{
                    className: classes.listbox,
                  }}
                >
                  <Option checkIcon={<></>} text="Read & Write" value={"write"}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <Text weight="semibold">Read & Write</Text>
                      <Text size={200}>
                        User can add, edit, remove and download project data and
                        use it for inference and training.
                      </Text>
                    </div>
                  </Option>
                  <Option checkIcon={<></>} text="Read Only" value={"read"}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <Text weight="semibold">Read Only</Text>
                      <Text size={200}>
                        User can download project data and use it for inference
                        and training.
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
          </div>
          {selectedIds.length === 0 && usersWithAccess?.length > 0 && (
            <div
              style={{
                maxHeight: "178px",
                marginTop: "15px",
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
                                {accessLevel === 1
                                  ? "Read & Write"
                                  : "Read Only"}
                              </Text>
                            }
                            onOptionSelect={(e, data) =>
                              setUserAccessLevel(
                                user.id,
                                data.optionText === "Read & Write" ? 1 : 0
                              )
                            }
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
                          />
                        </TableCellActions>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogActions style={{ marginTop: "auto", alignItems: "center" }}>
            {pendingChanges.size > 0 && (
              <Text
                align="center"
                italic={true}
                weight="semibold"
                style={{ color: tokens.colorNeutralForeground3 }}
              >
                Changes Pending
              </Text>
            )}
            <div style={{ marginLeft: "auto" }}>
              {pendingChanges.size > 0 || selectedIds.length > 0 ? (
                <>
                  <Button
                    disabled={pageBusy()}
                    onClick={discardChanges}
                    appearance="secondary"
                  >
                    Discard
                  </Button>
                  <Button
                    appearance="primary"
                    disabled={pageBusy()}
                    onClick={onConfirmChanges}
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
