import { useEffect, useRef, useState } from "react";
import {
  Field,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  makeStyles,
  tokens,
  mergeClasses,
} from "@fluentui/react-components";
import {
  AlphaSlider,
  ColorArea,
  ColorPicker,
  ColorSlider,
} from "@fluentui/react-color-picker";
import * as Utils from "@/utils/helpers";
import { type TransferFunctionInstance } from "@/stores/uiState/TransferFunction";
import ToastContainer from "@/utils/toastContainer";
import { observer } from "mobx-react-lite";
import Color from "color";
import DeleteButton from "./DeleteButton";
import { useRafMapScheduler } from "@/hooks/useRafMapScheduler";

interface TransferFunctionWidgetProps {
  transferFunction: TransferFunctionInstance;
}

interface HsvaColor {
  h: number;
  s: number;
  v: number;
  a?: number;
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

const TRANSPARENCY_CHECKER_LIGHT =
  "linear-gradient(45deg, #ececec 25%, transparent 25%, transparent 75%, #ececec 75%, #ececec)";
const TRANSPARENCY_CHECKER_DARK =
  "linear-gradient(45deg, #d4d4d4 25%, transparent 25%, transparent 75%, #d4d4d4 75%, #d4d4d4)";

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
  ({ transferFunction }: TransferFunctionWidgetProps) => {
    const classes = useStyles();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [openMarkerId, setOpenMarkerId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [pointerDownId, setPointerDownId] = useState<string | null>(null);
    const rampTrackRef = useRef<HTMLDivElement | null>(null);
    const dragMovedRef = useRef(false);
    const pointerDownRef = useRef<{ id: string; x: number } | null>(null);

    const schedulePositionUpdate = useRafMapScheduler<string, number>(
      (updates) => {
        updates.forEach((position, id) => {
          transferFunction.breakpoints.get(id)?.setPosition(position);
        });
      }
    );

    const scheduleColorUpdate = useRafMapScheduler<string, HsvaColor>(
      (updates) => {
        updates.forEach((color, id) => {
          transferFunction.breakpoints
            .get(id)
            ?.setHSV(color.h, color.s, color.v, color.a);
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
        setSelectedId(breakpoint.id);
        setOpenMarkerId(breakpoint.id);
      } catch (error) {
        const toastContainer = new ToastContainer();
        toastContainer.error(Utils.getErrorMessage(error));
        console.error("Error:", error);
      }
    };

    const deleteBreakpoint = (breakpointId: string) => {
      transferFunction.removeBreakpoint(breakpointId);
      if (selectedId === breakpointId) {
        setSelectedId(null);
      }
      if (openMarkerId === breakpointId) {
        setOpenMarkerId(null);
      }
    };

    useEffect(() => {
      if (!pointerDownId && !draggingId) {
        return;
      }

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

        dragMovedRef.current = true;
        setOpenMarkerId(pending.id);
        schedulePositionUpdate(pending.id, positionFromClientX(event.clientX));
      };

      const onPointerUp = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        pointerDownRef.current = null;
        setPointerDownId(null);
        setDraggingId(null);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);

      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
    }, [draggingId, pointerDownId, schedulePositionUpdate]);

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
              style={{
                backgroundImage: `${gradientBackground}, ${TRANSPARENCY_CHECKER_LIGHT}, ${TRANSPARENCY_CHECKER_DARK}`,
                backgroundSize: "100% 100%, 12px 12px, 12px 12px",
                backgroundPosition: "0 0, 0 0, 6px 6px",
              }}
              onClick={(event) =>
                addBreakpointAt(positionFromClientX(event.clientX))
              }
            />
          </Field>
          <div className={classes.markerTrack}>
            {transferFunction.sortedBreakpoints.map((point) => (
              <Popover
                withArrow
                key={point.id}
                open={openMarkerId === point.id}
                appearance="inverted"
                onOpenChange={(_, data) => {
                  if (
                    (draggingId === point.id || dragMovedRef.current) &&
                    !data.open
                  ) {
                    dragMovedRef.current = false;
                    setOpenMarkerId(point.id);
                    return;
                  }
                  setOpenMarkerId(data.open ? point.id : null);
                }}
                positioning={{
                  position: "above",
                  offset: 16,
                }}
              >
                <PopoverTrigger disableButtonEnhancement>
                  <button
                    type="button"
                    className={mergeClasses(
                      classes.marker,
                      point.id === selectedId && classes.markerActive
                    )}
                    style={{
                      left: `${point.position * 100}%`,
                      backgroundImage: `linear-gradient(${point.color}, ${point.color}), ${TRANSPARENCY_CHECKER_LIGHT}, ${TRANSPARENCY_CHECKER_DARK}`,
                      backgroundSize: "100% 100%, 8px 8px, 8px 8px",
                      backgroundPosition: "0 0, 0 0, 4px 4px",
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      dragMovedRef.current = false;
                      pointerDownRef.current = {
                        id: point.id,
                        x: event.clientX,
                      };
                      setPointerDownId(point.id);
                      setSelectedId(point.id);
                    }}
                    aria-label={`Select breakpoint at ${point.position.toFixed(2)}`}
                  />
                </PopoverTrigger>
                <PopoverSurface>
                  <div className={classes.popoverContent}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                        gap: "12px",
                      }}
                    >
                      <Field label="Position" style={{ flex: 1 }}>
                        <Input
                          step={0.001}
                          min={0}
                          max={1}
                          value={point.position.toFixed(4)}
                          onChange={(event) => {
                            const raw = Number(
                              (event.target as HTMLInputElement).value
                            );
                            if (Number.isFinite(raw)) {
                              schedulePositionUpdate(point.id, raw);
                            }
                          }}
                        />
                      </Field>

                      <div
                        className={classes.preview}
                        style={{
                          backgroundColor: point.color,
                          backgroundImage: `linear-gradient(${point.color}, ${point.color}), ${TRANSPARENCY_CHECKER_LIGHT}, ${TRANSPARENCY_CHECKER_DARK}`,
                          backgroundSize: "100% 100%, 8px 8px, 8px 8px",
                          backgroundPosition: "0 0, 0 0, 4px 4px",
                        }}
                      />
                    </div>

                    <div className={classes.pickerWrap}>
                      <ColorPicker
                        color={point.hsv}
                        onColorChange={(_, data) => {
                          scheduleColorUpdate(point.id, data.color);
                        }}
                      >
                        <ColorArea className={classes.colorArea} />
                        <ColorSlider />
                      </ColorPicker>
                      <AlphaSlider
                        color={point.hsv}
                        onChange={(_, data) => {
                          scheduleColorUpdate(point.id, data.color);
                        }}
                      />
                    </div>

                    <div className={classes.popoverActions}>
                      <DeleteButton
                        text={"Delete Marker"}
                        disabled={!transferFunction.canDeleteBreakpoint}
                        onClick={() => deleteBreakpoint(point.id)}
                      />
                    </div>
                  </div>
                </PopoverSurface>
              </Popover>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

export default TransferFunctionWidget;
