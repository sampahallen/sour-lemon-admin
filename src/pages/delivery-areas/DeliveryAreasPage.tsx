import { useEffect, useState } from 'react'
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

  const [name, setName] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setDeliveryFee(editing.deliveryFee ?? '')
      setIsActive(editing.isActive)
    } else if (isNew) {
      setName('')
      setDeliveryFee('')
      setIsActive(true)
    }
  }, [area]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    setIsSaving(true)
    try {
      const input = { name, deliveryFee: deliveryFee || null, isActive }
      if (editing) await updateDeliveryArea(token, editing.id, input)
      else await createDeliveryArea(token, input)
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Drawer isOpen={area !== null} onClose={onClose} title={editing ? 'Edit delivery area' : 'Add delivery area'}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-lg border border-cocoa/20 px-3 py-2 font-normal outline-none focus:border-flame"
            placeholder="e.g. East Legon"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold">
          Delivery fee (GHS)
          <input
            value={deliveryFee}
            onChange={(event) => setDeliveryFee(event.target.value)}
            className="rounded-lg border border-cocoa/20 px-3 py-2 font-normal outline-none focus:border-flame"
            placeholder="e.g. 25.00"
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active
        </label>

        <Button disabled={!name || isSaving} onClick={handleSubmit} className="mt-2">
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Drawer>
  )
}
