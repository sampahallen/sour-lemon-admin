import { useCallback, useState } from 'react'
import { ApiRequestError } from '@/api/client'

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>

const focusFirstError = <Field extends string>(errors: FieldErrors<Field>, prefix: string) => {
  const first = Object.keys(errors)[0]
  if (first) requestAnimationFrame(() => document.getElementById(`${prefix}-${first}`)?.focus())
}

export function useFormValidation<Field extends string>(prefix: string, validate: () => FieldErrors<Field>) {
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors<Field>>({})
  const clientErrors = validate()

  const error = (field: Field) => serverErrors[field] ?? (submitted || touched[field] ? clientErrors[field] : undefined)
  const props = (field: Field) => ({
    id: `${prefix}-${field}`,
    'aria-invalid': Boolean(error(field)),
    'aria-describedby': error(field) ? `${prefix}-${field}-error` : undefined,
    onBlur: () => setTouched((current) => ({ ...current, [field]: true })),
  })
  const changed = (field: Field) => setServerErrors((current) => {
    if (!current[field]) return current
    const next = { ...current }
    delete next[field]
    return next
  })
  const submit = (validateForSubmit = validate) => {
    setSubmitted(true)
    const errors = validateForSubmit()
    focusFirstError(errors, prefix)
    return Object.keys(errors).length === 0
  }
  const server = (caught: unknown, fieldMap: (path: string) => Field | undefined = (path) => path as Field) => {
    if (!(caught instanceof ApiRequestError)) return false
    const errors: FieldErrors<Field> = {}
    let hasUnmapped = false
    for (const detail of caught.details) {
      const field = fieldMap(detail.field)
      if (field) errors[field] = detail.message
      else hasUnmapped = true
    }
    if (!Object.keys(errors).length) return false
    setServerErrors(errors)
    setSubmitted(true)
    focusFirstError(errors, prefix)
    return !hasUnmapped
  }
  const reset = useCallback(() => {
    setTouched({})
    setSubmitted(false)
    setServerErrors({})
  }, [])

  return { error, props, changed, submit, server, reset }
}
