import { useEffect, useState } from 'react'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/auth/authContext'
import {
  createDeliveryArea,
  deleteDeliveryArea,
  listDeliveryAreas,
  updateDeliveryArea,
  type DeliveryArea,
} from '@/api/deliveryAreas'

export function DeliveryAreasPage() {
  const { session } = useAuth()
  const token = session!.token

  const [areas, setAreas] = useState<DeliveryArea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingArea, setEditingArea] = useState<DeliveryArea | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DeliveryArea | null>(null)

  const refresh = async () => {
    const { deliveryAreas } = await listDeliveryAreas(token)
    setAreas(deliveryAreas)
  }

  useEffect(() => {
    refresh().finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <PageHeader title="Delivery Areas" action={<Button onClick={() => setEditingArea('new')}>Add area</Button>} />

      {isLoading ? (
        <p className="text-cocoa/60">Loading…</p>
      ) : (
        <DataTable
          columns={[
            { header: 'Name', render: (area) => area.name },
            { header: 'Fee (GHS)', render: (area) => area.deliveryFee ?? '—' },
            { header: 'Status', render: (area) => (area.isActive ? 'Active' : 'Inactive') },
            {
              header: '',
              render: (area) => (
                <div className="flex justify-end gap-3 text-sm">
                  <button className="font-semibold text-flame" onClick={() => setEditingArea(area)}>
                    Edit
                  </button>
                  <button className="font-semibold text-cocoa/60" onClick={() => setPendingDelete(area)}>
                    Delete
                  </button>
                </div>
              ),
              className: 'text-right',
            },
          ]}
          rows={areas}
          rowKey={(area) => area.id}
          emptyState="No delivery areas yet. Add the towns you deliver to."
        />
      )}

      <DeliveryAreaDrawer
        key={editingArea === 'new' ? 'new' : editingArea?.id ?? 'closed'}
        area={editingArea}
        onClose={() => setEditingArea(null)}
        onSaved={async () => {
          setEditingArea(null)
          await refresh()
        }}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete delivery area"
        message={`Delete "${pendingDelete?.name}"? This can't be undone.`}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteDeliveryArea(token, pendingDelete.id)
          setPendingDelete(null)
          await refresh()
        }}
      />
    </div>
  )
}

function DeliveryAreaDrawer({
  area,
  onClose,
  onSaved,
}: {
  area: DeliveryArea | 'new' | null
  onClose: () => void
  onSaved: () => void
}) {
  const { session } = useAuth()
  const token = session!.token

  const isNew = area === 'new'
  const editing = isNew ? null : area

  const [name, setName] = useState(editing?.name ?? '')
  const [deliveryFee, setDeliveryFee] = useState(editing?.deliveryFee ?? '')
  const [isActive, setIsActive] = useState(editing?.isActive ?? true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  type AreaField = 'name' | 'deliveryFee'
  const validate = (): FieldErrors<AreaField> => {
    const errors: FieldErrors<AreaField> = {}
    if (!name.trim()) errors.name = 'Enter an area name.'
    else if (name.trim().length > 120) errors.name = 'Keep the name under 120 characters.'
    if (deliveryFee.trim() && (!/^\d+(?:\.\d{1,2})?$/.test(deliveryFee.trim()) || Number(deliveryFee) > 9_999_999_999.99)) {
      errors.deliveryFee = 'Enter a non-negative amount with up to two decimal places.'
    }
    return errors
  }
  const validation = useFormValidation<AreaField>('delivery-area', validate)

  const handleSubmit = async () => {
    if (!validation.submit()) return
    setIsSaving(true)
    setError(null)
    try {
      const input = { name: name.trim(), deliveryFee: deliveryFee.trim() || null, isActive }
      if (editing) await updateDeliveryArea(token, editing.id, input)
      else await createDeliveryArea(token, input)
      onSaved()
    } catch (caught) {
      if (!validation.server(caught, (path) => (['name', 'deliveryFee'] as string[]).includes(path) ? path as AreaField : undefined)) {
        setError(caught instanceof Error ? caught.message : 'Could not save this delivery area.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Drawer isOpen={area !== null} onClose={onClose} title={editing ? 'Edit delivery area' : 'Add delivery area'}>
      <div className="flex flex-col gap-4">
        {error ? <p role="alert" className="rounded-lg bg-flame/10 px-3 py-2 text-sm text-flame">{error}</p> : null}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Name
          <input
            {...validation.props('name')}
            value={name}
            onChange={(event) => { setName(event.target.value); validation.changed('name') }}
            className={`rounded-lg border border-cocoa/20 px-3 py-2 font-normal outline-none focus:border-flame ${validation.error('name') ? 'border-flame bg-flame/5' : ''}`}
            placeholder="e.g. East Legon"
          />
          {validation.error('name') ? <span id="delivery-area-name-error" className="text-xs text-flame">{validation.error('name')}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold">
          Delivery fee (GHS)
          <input
            {...validation.props('deliveryFee')}
            value={deliveryFee}
            onChange={(event) => { setDeliveryFee(event.target.value); validation.changed('deliveryFee') }}
            className={`rounded-lg border border-cocoa/20 px-3 py-2 font-normal outline-none focus:border-flame ${validation.error('deliveryFee') ? 'border-flame bg-flame/5' : ''}`}
            placeholder="e.g. 25.00"
          />
          {validation.error('deliveryFee') ? <span id="delivery-area-deliveryFee-error" className="text-xs text-flame">{validation.error('deliveryFee')}</span> : null}
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active
        </label>

        <Button disabled={isSaving} onClick={handleSubmit} className="mt-2">
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Drawer>
  )
}
