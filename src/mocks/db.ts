import type { DeliveryArea } from '@/api/deliveryAreas'
import type { SiteSection } from '@/api/siteSections'
import type { OrderDetail } from '@/api/orders'
import type { AppSetting } from '@/api/appSettings'

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()

// ---- Delivery areas ----
export const deliveryAreas: DeliveryArea[] = [
  { id: id(), name: 'Osu', slug: 'osu', deliveryFee: '25.00', isActive: true, sortOrder: 0, createdAt: now(), updatedAt: now() },
  { id: id(), name: 'East Legon', slug: 'east-legon', deliveryFee: '30.00', isActive: true, sortOrder: 10, createdAt: now(), updatedAt: now() },
  { id: id(), name: 'Dansoman', slug: 'dansoman', deliveryFee: '20.00', isActive: true, sortOrder: 20, createdAt: now(), updatedAt: now() },
  { id: id(), name: 'Tema', slug: 'tema', deliveryFee: '40.00', isActive: true, sortOrder: 30, createdAt: now(), updatedAt: now() },
  { id: id(), name: 'Spintex', slug: 'spintex', deliveryFee: '25.00', isActive: true, sortOrder: 40, createdAt: now(), updatedAt: now() },
]

// ---- Site sections (real keys, matches the backend seeder) ----
export const siteSections: SiteSection[] = [
  { id: id(), key: 'cakes', name: 'Cakes', isEnabled: true, showComingSoon: false, sortOrder: 0 },
  { id: id(), key: 'jams', name: 'Jams and syrups', isEnabled: false, showComingSoon: true, sortOrder: 10 },
  { id: id(), key: 'collaborations', name: 'Artist collaborations', isEnabled: false, showComingSoon: true, sortOrder: 20 },
  { id: id(), key: 'merch', name: 'Merch', isEnabled: false, showComingSoon: true, sortOrder: 30 },
  { id: id(), key: 'games', name: 'Games', isEnabled: false, showComingSoon: true, sortOrder: 40 },
]

// ---- Delivery area lookup used to denormalize orders ----
const deliveryAreaById = (deliveryAreaId: string | null) =>
  deliveryAreaId ? (deliveryAreas.find((area) => area.id === deliveryAreaId) ?? null) : null

const [osuId, eastLegonId] = deliveryAreas.map((area) => area.id)

// ---- Orders ----
export const orders: OrderDetail[] = [
  {
    id: id(),
    orderNumber: 'SL-1001',
    status: 'confirmed',
    paymentStatus: 'paid',
    fulfillmentType: 'sour_lemon_delivery',
    customerName: 'Ama Boateng',
    phoneNumber: '+233201234567',
    whatsappNumber: '+233201234567',
    deliveryAreaId: osuId,
    deliveryAreaName: deliveryAreaById(osuId)?.name ?? null,
    total: '470.00',
    currency: 'GHS',
    placedAt: now(),
    createdAt: now(),
    deliveryAddress: {
      recipientName: 'Ama Boateng',
      phoneNumber: '+233201234567',
      addressLine1: '12 Volta Street',
      city: 'Accra',
      landmark: 'Near Osu Oxford Street',
      deliveryAreaName: 'Osu',
    },
    subtotal: '445.00',
    deliveryFee: '25.00',
    customerNotes: 'Please add a "Happy Birthday Ama" topper.',
    items: [
      { id: id(), productName: 'Signature Celebration Cake', quantity: 1, unitPrice: '380.00', lineTotal: '380.00' },
      { id: id(), productName: 'Cherry Almond Mini', quantity: 1, unitPrice: '45.00', lineTotal: '45.00' },
      { id: id(), productName: 'Olive Oil Mini', quantity: 1, unitPrice: '45.00', lineTotal: '45.00' },
    ],
    statusHistory: [
      { toStatus: 'pending_payment', fromStatus: null, note: null, createdAt: now() },
      { toStatus: 'confirmed', fromStatus: 'pending_payment', note: 'Payment verified', createdAt: now() },
    ],
    payment: { provider: 'paystack', method: 'momo', status: 'paid', checkoutUrl: null, amount: '470.00' },
  },
  {
    id: id(),
    orderNumber: 'SL-1002',
    status: 'preparing',
    paymentStatus: 'paid',
    fulfillmentType: 'customer_rider',
    customerName: 'Kwesi Owusu',
    phoneNumber: '+233247654321',
    whatsappNumber: null,
    deliveryAreaId: eastLegonId,
    deliveryAreaName: deliveryAreaById(eastLegonId)?.name ?? null,
    total: '90.00',
    currency: 'GHS',
    placedAt: now(),
    createdAt: now(),
    deliveryAddress: {
      recipientName: 'Kwesi Owusu',
      phoneNumber: '+233247654321',
      addressLine1: '4 Lagos Avenue',
      city: 'Accra',
      deliveryAreaName: 'East Legon',
    },
    subtotal: '90.00',
    deliveryFee: '0.00',
    customerNotes: null,
    items: [{ id: id(), productName: 'Olive Oil Mini', quantity: 2, unitPrice: '45.00', lineTotal: '90.00' }],
    statusHistory: [
      { toStatus: 'pending_payment', fromStatus: null, note: null, createdAt: now() },
      { toStatus: 'confirmed', fromStatus: 'pending_payment', note: null, createdAt: now() },
      { toStatus: 'preparing', fromStatus: 'confirmed', note: null, createdAt: now() },
    ],
    payment: { provider: 'paystack', method: 'card', status: 'paid', checkoutUrl: null, amount: '90.00' },
  },
  {
    id: id(),
    orderNumber: 'SL-1003',
    status: 'pending_payment',
    paymentStatus: 'cash_due',
    fulfillmentType: 'pickup',
    customerName: 'Efua Mensah',
    phoneNumber: '+233551122334',
    whatsappNumber: '+233551122334',
    deliveryAreaId: null,
    deliveryAreaName: null,
    total: '45.00',
    currency: 'GHS',
    placedAt: now(),
    createdAt: now(),
    deliveryAddress: null,
    subtotal: '45.00',
    deliveryFee: '0.00',
    customerNotes: null,
    items: [{ id: id(), productName: 'Cherry Almond Mini', quantity: 1, unitPrice: '45.00', lineTotal: '45.00' }],
    statusHistory: [{ toStatus: 'pending_payment', fromStatus: null, note: null, createdAt: now() }],
    payment: null,
  },
]


// ---- App settings (real keys + defaults from the backend seeder) ----
export const appSettings: AppSetting[] = [
  { key: 'business_whatsapp_number', value: null, description: 'WhatsApp number used for customer handoffs', updatedAt: now() },
  { key: 'pickup_location', value: null, description: 'Customer-facing pickup location', updatedAt: now() },
  { key: 'manual_payment_review', value: true, description: 'Require owner review after verified payment', updatedAt: now() },
  { key: 'delivery_fee_mode', value: 'rider', description: 'Whether delivery fees come from areas or riders', updatedAt: now() },
  { key: 'menu_scheduling_enabled', value: false, description: 'Allow scheduled catalog availability', updatedAt: now() },
]
