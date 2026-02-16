import {
  Button,
  Menu,
  MenuTrigger,
  MenuList,
  MenuPopover,
} from "@fluentui/react-components";
import { makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  button: { border: "0px", fontWeight: tokens.fontWeightRegular },
  list: { position: "absolute", width: "200px", top: "500px", left: "500px" },
  sbutton: { padding: "0px" },
});

import type { ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode[];
}

const MenuBarItem = ({ label, children }: Props) => {
  const classes = useStyles();

  return (
    <Menu closeOnScroll>
      <MenuTrigger>
        <Button className={classes.button}>{label}</Button>
      </MenuTrigger>

      <MenuPopover>
        <MenuList>{children}</MenuList>
      </MenuPopover>
    </Menu>
  );
};

export default MenuBarItem;
