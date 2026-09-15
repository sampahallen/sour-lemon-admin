import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatGhanaDate } from '@/utils/ghanaDateTime'

const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('en-GH', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, month, 1))),
)
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const today = () => new Date().toISOString().slice(0, 10)
const dateKey = (date: Date) => date.toISOString().slice(0, 10)

type ValidationProps = {
  id: string
  'aria-invalid': boolean
  'aria-describedby'?: string
  onBlur: () => void
}

export function AvailabilityDateTimePicker({
  label,
  value,
  defaultTime,
  isCalendarOpen,
  onToggleCalendar,
  onChange,
  error,
  validationProps,
}: {
  label: string
  value: string
  defaultTime: string
  isCalendarOpen: boolean
  onToggleCalendar: () => void
  onChange: (next: string) => void
  error?: string
  validationProps: ValidationProps
}) {
  const selectedDate = value.slice(0, 10)
  const selectedTime = value.slice(11, 16)
  const [viewDate, setViewDate] = useState(() => selectedDate || today())
  const [yearText, setYearText] = useState(() => (selectedDate || today()).slice(0, 4))
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { id } = validationProps
  const calendarId = `${id}-calendar`
  const viewYear = Number(viewDate.slice(0, 4))
  const viewMonth = Number(viewDate.slice(5, 7)) - 1
  const firstDay = new Date(Date.UTC(viewYear, viewMonth, 1))
  const gridStart = new Date(firstDay)
  gridStart.setUTCDate(1 - (firstDay.getUTCDay() + 6) % 7)
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setUTCDate(gridStart.getUTCDate() + index)
    return day
  })
  const focusedDay = selectedDate && days.some((day) => dateKey(day) === selectedDate)
    ? selectedDate
    : days.some((day) => dateKey(day) === today()) ? today() : dateKey(firstDay)

  const setViewedMonth = (year: number, month: number) => {
    const next = new Date(Date.UTC(year, month, 1))
    setViewDate(dateKey(next))
    setYearText(String(next.getUTCFullYear()))
  }

  useEffect(() => {
    if (!isCalendarOpen) return
    const focusId = `${calendarId}-${focusedDay}`
    requestAnimationFrame(() => document.getElementById(focusId)?.focus())
    // Opening the panel moves keyboard focus to its selected or current day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalendarOpen])

  const closeCalendar = () => {
    onToggleCalendar()
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const toggleCalendar = () => {
    if (!isCalendarOpen && selectedDate) {
      setViewedMonth(Number(selectedDate.slice(0, 4)), Number(selectedDate.slice(5, 7)) - 1)
    }
    onToggleCalendar()
  }

  const chooseDate = (day: string) => {
    onChange(`${day}T${selectedTime || defaultTime}`)
    closeCalendar()
  }

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, day: Date) => {
    const offset = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }[event.key]
    if (offset === undefined) return
    event.preventDefault()
    const next = new Date(day)
    next.setUTCDate(next.getUTCDate() + offset)
    if (next.getUTCMonth() !== viewMonth || next.getUTCFullYear() !== viewYear) {
      setViewedMonth(next.getUTCFullYear(), next.getUTCMonth())
    }
    requestAnimationFrame(() => document.getElementById(`${calendarId}-${dateKey(next)}`)?.focus())
  }

  const hour24 = Number(selectedTime.slice(0, 2))
  const minute = selectedTime.slice(3, 5)
  const hour12 = hour24 % 12 || 12
  const period = hour24 < 12 ? 'AM' : 'PM'
  const minuteOptions = [...new Set(['00', '15', '30', '45', minute])].filter(Boolean).sort()
  const changeTime = (hour: number, nextMinute: string, nextPeriod: string) => {
    const nextHour = hour % 12 + (nextPeriod === 'PM' ? 12 : 0)
    onChange(`${selectedDate}T${String(nextHour).padStart(2, '0')}:${nextMinute}`)
  }

  return (
    <div className="rounded-xl border border-cocoa/15 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {value ? (
          <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-flame hover:underline">
            Clear
          </button>
        ) : null}
      </div>
      <button
        {...validationProps}
        ref={triggerRef}
        type="button"
        aria-expanded={isCalendarOpen}
        aria-controls={calendarId}
        onClick={toggleCalendar}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm outline-none focus:border-flame ${error ? 'border-flame bg-flame/5' : 'border-cocoa/20'}`}
      >
        <span>{selectedDate ? formatGhanaDate(selectedDate) : 'Choose a date'}</span>
        <span aria-hidden="true" className="text-cocoa/50">▾</span>
      </button>
      {isCalendarOpen ? (
        <div
          id={calendarId}
          className="mt-2 rounded-lg border border-cocoa/10 bg-cream/40 p-2"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              closeCalendar()
            }
          }}
        >
          <div className="mb-3 flex items-center gap-1">
            <button type="button" aria-label="Previous month" onClick={() => setViewedMonth(viewYear, viewMonth - 1)} className="rounded px-2 py-1 hover:bg-cocoa/10">‹</button>
            <select
              aria-label={`${label} month`}
              value={viewMonth}
              onChange={(event) => setViewedMonth(viewYear, Number(event.target.value))}
              className="min-w-0 flex-1 rounded border border-cocoa/20 bg-white px-1 py-1 text-sm"
            >
              {monthNames.map((name, month) => <option key={name} value={month}>{name}</option>)}
            </select>
            <input
              type="number"
              aria-label={`${label} year`}
              min={1000}
              max={9999}
              value={yearText}
              onChange={(event) => {
                setYearText(event.target.value)
                const year = Number(event.target.value)
                if (event.target.value.length === 4 && year >= 1000 && year <= 9999) setViewedMonth(year, viewMonth)
              }}
              onBlur={() => setYearText(String(viewYear))}
              className="w-20 rounded border border-cocoa/20 bg-white px-1 py-1 text-sm"
            />
            <button type="button" aria-label="Next month" onClick={() => setViewedMonth(viewYear, viewMonth + 1)} className="rounded px-2 py-1 hover:bg-cocoa/10">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {weekDays.map((day) => <span key={day} className="py-1 font-semibold text-cocoa/60">{day}</span>)}
            {days.map((day) => {
              const dayValue = dateKey(day)
              const isSelected = dayValue === selectedDate
              return (
                <button
                  key={dayValue}
                  id={`${calendarId}-${dayValue}`}
                  type="button"
                  tabIndex={dayValue === focusedDay ? 0 : -1}
                  aria-label={formatGhanaDate(dayValue)}
                  aria-pressed={isSelected}
                  aria-current={dayValue === today() ? 'date' : undefined}
                  onKeyDown={(event) => moveFocus(event, day)}
                  onClick={() => chooseDate(dayValue)}
                  className={`rounded-lg py-1.5 text-sm outline-none focus:ring-2 focus:ring-flame ${isSelected ? 'bg-flame font-bold text-white' : day.getUTCMonth() === viewMonth ? 'hover:bg-cocoa/10' : 'text-cocoa/40 hover:bg-cocoa/10'}`}
                >
                  {day.getUTCDate()}
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => chooseDate(today())} className="mt-2 rounded-lg px-2 py-1 text-xs font-semibold text-flame hover:bg-flame/10">
            Today
          </button>
        </div>
      ) : null}
      {selectedDate ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-semibold text-cocoa/65">Time</span>
          <select aria-label={`${label} hour`} value={hour12} onChange={(event) => changeTime(Number(event.target.value), minute, period)} className="min-w-0 flex-1 rounded-lg border border-cocoa/20 bg-white px-2 py-2 text-sm">
            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
          </select>
          <span aria-hidden="true">:</span>
          <select aria-label={`${label} minute`} value={minute} onChange={(event) => changeTime(hour12, event.target.value, period)} className="min-w-0 flex-1 rounded-lg border border-cocoa/20 bg-white px-2 py-2 text-sm">
            {minuteOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select aria-label={`${label} AM or PM`} value={period} onChange={(event) => changeTime(hour12, minute, event.target.value)} className="rounded-lg border border-cocoa/20 bg-white px-2 py-2 text-sm">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      ) : null}
      {error ? <p id={`${id}-error`} className="mt-2 text-xs font-medium text-flame">{error}</p> : null}
    </div>
  )
}
