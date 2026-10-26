import * as LabelPrimitive from "@radix-ui/react-label"
import { useId, type HTMLAttributes, type LabelHTMLAttributes, type ReactNode } from "react"
import { cn } from "../lib/cn"
import { Input, type InputProps } from "./input"

export function Field({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid gap-1.5", className)} {...props}>
      {children}
    </div>
  )
}

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-xs font-medium text-fg-muted", className)}
      {...props}
    />
  )
}

export function FieldDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-fg-subtle", className)} {...props} />
}

export function FieldError({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p role="alert" className={cn("text-xs text-danger", className)} {...props} />
}

export type TextFieldProps = Omit<InputProps, "id" | "invalid"> & {
  readonly id?: string
  readonly label: string
  readonly description?: string
  readonly error?: string
  readonly fieldClassName?: string
  readonly trailing?: ReactNode
}

/**
 * The common case: a label, an input, and at most one hint or error, wired with
 * the ids a screen reader needs.
 */
export function TextField({
  id: idProp,
  label,
  description,
  error,
  fieldClassName,
  trailing,
  className,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`
  const describedBy = error !== undefined ? errorId : description !== undefined ? descriptionId : undefined

  return (
    <Field className={fieldClassName}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(trailing !== undefined && "pr-9", className)}
          {...inputProps}
        />
        {trailing !== undefined ? (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        ) : null}
      </div>
      {error !== undefined ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : description !== undefined ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
    </Field>
  )
}
