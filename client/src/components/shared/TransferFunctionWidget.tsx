import { useEffect, useRef, useState } from "react";
import {
  Field,
  makeStyles,
  tokens,
  mergeClasses,
} from "@fluentui/react-components";
import * as Utils from "@/utils/helpers";
import { type TransferFunctionInstance } from "@/stores/uiState/TransferFunction";
import ToastContainer from "@/utils/toastContainer";
import { observer } from "mobx-react-lite";
import Color from "color";
import { useRafMapScheduler } from "@/hooks/useRafMapScheduler";
import {
  TRANSPARENCY_CHECKER_DARK,
  TRANSPARENCY_CHECKER_LIGHT,
} from "@/utils/transparencyChecker";

interface TransferFunctionWidgetProps {
  transferFunction: TransferFunctionInstance;
  openMarkerId: string | null;
  setOpenMarkerId: (id: string | null) => void;
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "100%",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    alignItems: "center",
    gap: "8px",
  },
  rampWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  rampTrack: {
    width: "100%",
    height: "12px",
    borderRadius: "2px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: "pointer",
  },
  markerTrack: {
    position: "relative",
    height: "26px",
  },
  marker: {
    position: "absolute",
    top: "0px",
    width: "14px",
    height: "14px",
    borderRadius: "999px",
    border: `2px solid ${tokens.colorNeutralStroke1}`,
    transform: "translateX(-50%)",
    cursor: "pointer",
    minWidth: 0,
    padding: 0,
  },
  markerActive: {
    outlineStyle: "solid",
    outlineWidth: "2px",
    outlineColor: tokens.colorBrandStroke1,
  },
  markerPopoverOpen: {
    outlineStyle: "solid",
    outlineWidth: "2px",
    outlineColor: tokens.colorPaletteDarkOrangeForeground1,
  },
  colorArea: {
    minWidth: "250px",
    minHeight: "250px",
  },
  axis: {
    display: "flex",
    justifyContent: "space-between",
    color: tokens.colorNeutralForeground3,
  },
  popoverContent: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  popoverActions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  preview: {
    width: "30px",
    height: "30px",
    borderRadius: "6px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  pickerWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

function toCssGradient(transferFunction: TransferFunctionInstance) {
  const sorted = transferFunction.sortedBreakpoints;
  return `linear-gradient(90deg, ${sorted
    .map((point) => `${point.color} ${Math.round(point.position * 100)}%`)
    .join(", ")})`;
}

function colorAtPosition(
  transferFunction: TransferFunctionInstance,
  position: number
) {
  const sorted = transferFunction.sortedBreakpoints;
  const pos = Utils.clamp(position, 0, 1);

  if (pos <= sorted[0].position) {
    return sorted[0].color;
  }

  if (pos >= sorted[sorted.length - 1].position) {
    return sorted[sorted.length - 1].color;
  }

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const left = sorted[index];
    const right = sorted[index + 1];
    if (pos >= left.position && pos <= right.position) {
      const span = right.position - left.position;
      const t = span === 0 ? 0 : (pos - left.position) / span;

      const cLeft = Color(left.color);
      const cRight = Color(right.color);

      return cLeft.mix(cRight, Utils.clamp(t, 0, 1)).hexa();
    }
  }

  return sorted[sorted.length - 1].color;
}

const TransferFunctionWidget = observer(
  ({
    transferFunction,
    openMarkerId,
    setOpenMarkerId,
  }: TransferFunctionWidgetProps) => {
    const classes = useStyles();

    const [draggingId, setDraggingId] = useState<string | null>(null);
    const rampTrackRef = useRef<HTMLDivElement | null>(null);
    const pointerDownRef = useRef<{ id: string; x: number } | null>(null);

    const schedulePositionUpdate = useRafMapScheduler<string, number>(
      (updates) => {
        updates.forEach((position, id) => {
          transferFunction.breakpoints.get(id)?.setPosition(position);
        });
      }
    );

    const positionFromClientX = (clientX: number) => {
      if (!rampTrackRef.current) {
        return 0;
      }

      const rect = rampTrackRef.current.getBoundingClientRect();
      if (rect.width === 0) {
        return 0;
      }

      return Utils.clamp((clientX - rect.left) / rect.width, 0, 1);
    };

    const addBreakpointAt = (position: number) => {
      try {
        const color = colorAtPosition(transferFunction, position);
        const nextBreakpoint = {
          position,
          color,
        };
        const breakpoint = transferFunction.addBreakpoint(nextBreakpoint);
        setOpenMarkerId(breakpoint.id);
      } catch (error) {
        const toastContainer = new ToastContainer();
        toastContainer.error(Utils.getErrorMessage(error));
        console.error("Error:", error);
      }
    };

    useEffect(() => {
      const onPointerMove = (event: PointerEvent) => {
        const pending = pointerDownRef.current;
        if (!pending) {
          return;
        }

        const moved = Math.abs(event.clientX - pending.x);
        if (moved < 2 && draggingId !== pending.id) {
          return;
        }

        if (draggingId !== pending.id) {
          setDraggingId(pending.id);
        }

        schedulePositionUpdate(pending.id, positionFromClientX(event.clientX));
      };

      const onPointerUp = () => {
        pointerDownRef.current = null;
        setDraggingId(null);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);

      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
    }, [draggingId, schedulePositionUpdate]);

    const gradientBackground = toCssGradient(transferFunction);

    return (
      <div className={classes.root}>
        <div className={classes.rampWrap}>
          {/* <div className={classes.axis}>
            <Text size={200}>0</Text>
            <Text size={200}>1</Text>
          </div> */}
          <Field>
            <div
              className={classes.rampTrack}
              ref={rampTrackRef}
              title="Shift+click or double-click to add breakpoint"
              style={{
                backgroundImage: `${gradientBackground}, ${TRANSPARENCY_CHECKER_LIGHT}, ${TRANSPARENCY_CHECKER_DARK}`,
                backgroundSize: "100% 100%, 12px 12px, 12px 12px",
                backgroundPosition: "0 0, 0 0, 6px 6px",
              }}
              onDoubleClick={(event) => {
                if (event.shiftKey) {
                  return;
                }
                addBreakpointAt(positionFromClientX(event.clientX));
              }}
              onClick={(event) => {
                {
                  if (!event.shiftKey) {
                    return;
                  }
                  addBreakpointAt(positionFromClientX(event.clientX));
                }
              }}
            />
          </Field>
          <div className={classes.markerTrack}>
            {transferFunction.sortedBreakpoints.map((point) => (
              <button
                key={point.id}
                type="button"
                title={
                  openMarkerId !== point.id
                    ? "Click to open breakpoint options"
                    : "Click to close breakpoint options"
                }
                className={mergeClasses(
                  classes.marker,
                  point.id === draggingId && classes.markerActive,
                  openMarkerId === point.id &&
                    openMarkerId !== draggingId &&
                    classes.markerPopoverOpen
                )}
                style={{
                  left: `${point.position * 100}%`,
                  backgroundImage: `linear-gradient(${point.color}, ${point.color}), ${TRANSPARENCY_CHECKER_LIGHT}, ${TRANSPARENCY_CHECKER_DARK}`,
                  backgroundSize: "100% 100%, 8px 8px, 8px 8px",
                  backgroundPosition: "0 0, 0 0, 4px 4px",
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setOpenMarkerId(openMarkerId === point.id ? null : point.id);
                  pointerDownRef.current = {
                    id: point.id,
                    x: event.clientX,
                  };
                }}
                aria-label={`Select breakpoint at ${point.position.toFixed(2)}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
);

export default TransferFunctionWidget;
