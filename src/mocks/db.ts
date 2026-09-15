import type { DeliveryArea } from '@/api/deliveryAreas'
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

// ---- Delivery area lookup used to denormalize orders ----
const deliveryAreaById = (deliveryAreaId: string | null) =>
  deliveryAreaId ? (deliveryAreas.find((area) => area.id === deliveryAreaId) ?? null) : null

const [osuId, eastLegonId] = deliveryAreas.map((area) => area.id)

// ---- Orders ----
export const orders: OrderDetail[] = [
  {
    id: id(),
    orderNumber: 'A10001',
    status: 'received',
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
      { id: id(), productName: 'Signature Celebration Cake', productImageUrl: null, quantity: 1, unitPrice: '380.00', lineTotal: '380.00' },
      { id: id(), productName: 'Cherry Almond Mini', productImageUrl: null, quantity: 1, unitPrice: '45.00', lineTotal: '45.00' },
      { id: id(), productName: 'Olive Oil Mini', productImageUrl: null, quantity: 1, unitPrice: '45.00', lineTotal: '45.00' },
    ],
    statusHistory: [
      { toStatus: 'pending_payment', fromStatus: null, note: null, createdAt: now() },
      { toStatus: 'confirmed', fromStatus: 'pending_payment', note: 'Payment verified', createdAt: now() },
    ],
    paymentDisplayStatus: 'needs_review',
    paymentGroup: 'needs_attention',
    availableActions: ['confirm_payment', 'cancel'],
    payment: {
      id: id(),
      provider: 'paystack',
      method: 'momo',
      paymentName: 'Akosua Boateng',
      status: 'paid',
      checkoutUrl: null,
      amount: '470.00',
      displayStatus: 'needs_review',
      requiresManualConfirmation: true,
      adminConfirmedAt: null,
      adminConfirmedByUserId: null,
      paidAt: now(),
    },
    allowedTransitions: ['preparing', 'cancelled'],
  },
  {
    id: id(),
    orderNumber: 'A10002',
    status: 'preparing',
    paymentStatus: 'paid',
    paymentDisplayStatus: 'confirmed',
    paymentGroup: 'paid',
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
    items: [{ id: id(), productName: 'Olive Oil Mini', productImageUrl: null, quantity: 2, unitPrice: '45.00', lineTotal: '90.00' }],
    statusHistory: [
      { toStatus: 'pending_payment', fromStatus: null, note: null, createdAt: now() },
      { toStatus: 'confirmed', fromStatus: 'pending_payment', note: null, createdAt: now() },
      { toStatus: 'preparing', fromStatus: 'confirmed', note: null, createdAt: now() },
    ],
    availableActions: ['mark_ready', 'cancel'],
    payment: {
      id: id(),
      provider: 'paystack',
      method: 'card',
      paymentName: 'Kwesi Owusu',
      status: 'paid',
      checkoutUrl: null,
      amount: '90.00',
      displayStatus: 'confirmed',
      requiresManualConfirmation: true,
      adminConfirmedAt: now(),
      adminConfirmedByUserId: id(),
      paidAt: now(),
    },
    allowedTransitions: ['ready_for_pickup'],
  },
  {
    id: id(),
    orderNumber: 'A10003',
    status: 'received',
    paymentStatus: 'cash_due',
    paymentDisplayStatus: 'cash_due',
    paymentGroup: 'pending',
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
    items: [{ id: id(), productName: 'Cherry Almond Mini', productImageUrl: null, quantity: 1, unitPrice: '45.00', lineTotal: '45.00' }],
    statusHistory: [{ toStatus: 'pending_payment', fromStatus: null, note: null, createdAt: now() }],
    availableActions: ['collect_cash', 'start_preparing', 'cancel'],
    payment: {
      id: id(),
      provider: 'cash',
      method: 'cash',
      paymentName: null,
      status: 'cash_due',
      checkoutUrl: null,
      amount: '45.00',
      displayStatus: 'cash_due',
      requiresManualConfirmation: true,
      adminConfirmedAt: null,
      adminConfirmedByUserId: null,
      paidAt: null,
    },
    allowedTransitions: ['preparing', 'cancelled'],
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
