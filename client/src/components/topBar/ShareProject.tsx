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
  Switch,
  Spinner,
} from "@fluentui/react-components";
import { useState, useEffect, useRef, SyntheticEvent } from "react";
import Utils from "../../functions/Utils";
import {
  bundleIcon,
  LinkRegular,
  PeopleSubtractFilled,
  PeopleSubtractRegular,
} from "@fluentui/react-icons";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";
import { UserDB } from "../../stores/userState/UserModel";
import { toast } from "react-toastify";

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

interface UserAccessInfo {
  userId: number;
  accessLevel: number;
}

interface AccessInfoChanges {
  publicAccess: number;
  userAccess: UserAccessInfo[];
}

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const ShareProject = observer(({ open, setOpen }: Props) => {
  const { user } = useMst();

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

  const [publicAccess, setPublicAccess] = useState(activeProject?.publicAccess);

  const [usersWithAccess, setUsersWithAccess] = useState<
    { user: UserDB; accessLevel: number; changed: boolean }[]
  >([]);

  const [tagPickerOptions, setTagPickerOptions] = useState<UserDB[]>([]);

  const [isFetchingData, setIsFetchingData] = useState(false);

  const [isModifyingAccess, setIsModifyingAccess] = useState(false);

  const pageBusy = () => {
    return isFetchingData || isModifyingAccess;
  };

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [isScrolled, setIsScrolled] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const [pendingChanges, setPendingChanges] = useState(new Map());

  const [isHoveringOverTagPicker, setIsHoveringOverTagPicker] = useState(false);

  const canSetSharing = () => {
    return !user.isGuest && user.id === activeProject?.ownerId;
  };

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

  const fetchProjectAccessData = async () => {
    try {
      if (!activeProject) {
        throw new Error("No active project");
      }

      setIsFetchingData(true);
      let allUsers;
      let accessInfo: {
        projectAccess: { ownerId: number; publicAccess: number };
        userAccess: Array<{ userId: number; accessLevel: number }>;
      };

      try {
        let response = await Utils.sendReq(
          "users",
          {
            method: "GET",
          },
          false
        );

        allUsers = await response.json();

        response = await Utils.sendReq(
          `project/${activeProject.id}/access`,
          {
            method: "GET",
          },
          false
        );

        accessInfo = await response.json();
      } catch (error) {
        throw new Error("Failed to fetch users or access info.");
      }

      activeProject.setPublicAccess(accessInfo.projectAccess.publicAccess);
      setPublicAccess(activeProject.publicAccess);

      users.current = allUsers;

      updateAccessInfoMap(accessInfo.userAccess);

      refreshUsersWithAccess();
      refreshTagPickerOptions();
    } catch (error) {
      console.error(error);
      setOpen(false);
      const errMsg = Utils.getErrorMessage(error);
      toast.error(
        errMsg || "Failed to fetch project access data. Please try again."
      );
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
      fetchProjectAccessData();
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
    let toastId = null;
    try {
      if (pageBusy() || !activeProject) {
        return;
      }

      toastId = toast.loading("Modifying access...");

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
        const level = accessLevel === "Read & Write" ? 1 : 0;
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

      const response = await Utils.sendReq(
        `project/${activeProject.id}/access`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAccess: changes,
            publicAccess: publicAccess,
          }),
        },
        false
      );
      const accessInfoChanges: AccessInfoChanges = await response.json();

      resetChanges();

      updateAccessInfoMap(accessInfoChanges.userAccess);
      activeProject.setPublicAccess(accessInfoChanges.publicAccess);
      setPublicAccess(activeProject.publicAccess);

      toast.update(toastId, {
        render: "Access modified successfully!",
        type: "success",
        isLoading: false,
        autoClose: 2000,
      });
    } catch (error) {
      Utils.updateToastWithErrorMsg(toastId, error);
      console.error(error);
    } finally {
      setIsModifyingAccess(false);
    }
  };

  const updateAccessInfoMap = (userAccessInfo: UserAccessInfo[]) => {
    const accessMap = new Map(
      userAccessInfo.map(({ userId, accessLevel }) => [userId, accessLevel])
    );
    accessInfoMap.current = accessMap;

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

  const resetChanges = () => {
    if (pendingChanges.size > 0) {
      setPendingChanges(new Map());
    }
    if (selectedIds.length > 0) {
      setSelectedIds([]);
    }
    setPublicAccess(activeProject?.publicAccess);
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
            {pageBusy() && <Spinner delay={200} />}
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
                    pendingChanges.size > 0 || pageBusy() || !canSetSharing()
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
                    onOptionSelect={(e, data) =>
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
                visible={!canSetSharing() && isHoveringOverTagPicker}
                positioning="below"
              >
                <div></div>
              </Tooltip>
            </div>
            {selectedIds.length === 0 && usersWithAccess?.length > 0 && (
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
                                disabled={!canSetSharing() || pageBusy()}
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
                                disabled={!canSetSharing() || pageBusy()}
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
                disabled={pageBusy()}
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
                    disabled={pageBusy()}
                    onClick={resetChanges}
                    appearance="secondary"
                  >
                    Discard
                  </Button>
                  <Button
                    appearance="primary"
                    disabled={pageBusy() || !canSetSharing()}
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
