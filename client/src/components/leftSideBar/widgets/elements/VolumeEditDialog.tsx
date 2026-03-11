import { useEffect } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Input,
  Field,
  Textarea,
  Spinner,
  Select,
  makeStyles,
  Divider,
} from "@fluentui/react-components";
import { volumeUpdateSchema } from "@cocryovis/schemas/componentSchemas/volume-schema";
import type z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, useWatch } from "react-hook-form";
import { physicalUnitSchema } from "@cocryovis/schemas/componentSchemas/volume-settings-schema";

type VolumeUpdateSchema = z.infer<typeof volumeUpdateSchema>;
const labels = physicalUnitSchema.meta()?.labels as
  | Record<string, string>
  | undefined;

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  onEdit: (data: VolumeUpdateSchema) => Promise<void>;
  isActive: boolean;
  defaults: VolumeUpdateSchema;
}

const useStyles = makeStyles({
  dialogContent: {
    padding: "15px 0",
    display: "grid",
    gap: "12px",
  },
  sizeFieldsContainer: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    height: "100px",
  },
  sizeField: {
    height: "fit-content",
    "& input": {
      width: "100%",
    },
  },
});

const axes = ["X", "Y", "Z"] as const;

const VolumeEditDialog = ({
  open,
  onClose,
  onEdit,
  isActive,
  title,
  defaults,
}: Props) => {
  const classes = useStyles();

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<VolumeUpdateSchema>({
    resolver: zodResolver(volumeUpdateSchema),
    mode: "onChange",
    defaultValues: defaults,
  });

  const loading = isSubmitting || isActive;

  useEffect(() => {
    if (open) {
      reset(defaults);
    }
  }, [open, defaults, reset]);

  const onSubmit = async (data: VolumeUpdateSchema) => {
    console.log(data);
    try {
      await onEdit(data);
      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  const physicalUnit = useWatch({
    control,
    name: "physicalUnit",
  });

  return (
    <Dialog open={open}>
      <DialogSurface>
        <form
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e);
          }}
        >
          <DialogBody>
            <DialogTitle>{title}</DialogTitle>

            <DialogContent className={classes.dialogContent}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Field
                    label="Name"
                    validationState={errors.name ? "error" : "none"}
                    validationMessage={errors.name?.message ?? "\u00A0"}
                  >
                    <Input
                      {...field}
                      appearance="underline"
                      value={field.value ?? ""}
                    />
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Field
                    label="Description"
                    validationState={errors.description ? "error" : "none"}
                    validationMessage={errors.description?.message ?? "\u00A0"}
                  >
                    <Textarea
                      {...field}
                      textarea={{ rows: 4 }}
                      value={field.value ?? ""}
                    />
                  </Field>
                )}
              />
              <Divider>Physical Size</Divider>
              <div className={classes.sizeFieldsContainer}>
                <Field
                  label="Unit"
                  validationState={errors.physicalUnit ? "error" : "none"}
                  validationMessage={errors.physicalUnit?.message ?? "\u00A0"}
                  className={classes.sizeField}
                >
                  <Select
                    {...register("physicalUnit")}
                    style={{ width: "fit-content" }}
                  >
                    {physicalUnitSchema.options.map((value) => (
                      <option key={value} value={value}>
                        {labels?.[value] ?? value}
                      </option>
                    ))}
                  </Select>
                </Field>

                {axes.map((axis) => {
                  const fieldName = `physicalSize${axis}` as const;
                  const error = errors[fieldName];
                  const defaultValue = defaults[fieldName];

                  return (
                    <Field
                      key={axis}
                      label={axis}
                      validationState={
                        error && physicalUnit !== "PIXEL" ? "error" : "none"
                      }
                      validationMessage={
                        error && physicalUnit !== "PIXEL"
                          ? error.message
                          : "\u00A0"
                      }
                      className={classes.sizeField}
                    >
                      {physicalUnit === "PIXEL" ? (
                        <Input key={`${axis}-auto`} value="auto" disabled />
                      ) : (
                        <Input
                          key={`${axis}-input`}
                          defaultValue={defaultValue?.toString()}
                          {...register(fieldName, { valueAsNumber: true })}
                        />
                      )}
                    </Field>
                  );
                })}
              </div>
            </DialogContent>

            <DialogActions>
              {loading ? (
                <Spinner appearance="primary" size="medium" />
              ) : (
                <>
                  <Button appearance="secondary" onClick={onClose}>
                    Cancel
                  </Button>

                  <Button
                    appearance="primary"
                    type="submit"
                    disabled={!isValid}
                  >
                    Update
                  </Button>
                </>
              )}
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
};

export default VolumeEditDialog;
