import { createBrowserRouter, Navigate } from 'react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RequireAdmin } from '@/auth/RequireAdmin'
import { SignIn } from '@/pages/SignIn'
import { NotFound } from '@/pages/NotFound'
import { OrdersPage } from '@/pages/orders/OrdersPage'
import { OrderDetailPage } from '@/pages/orders/OrderDetailPage'
import { CustomCakeRequestsPage } from '@/pages/custom-cakes/CustomCakeRequestsPage'
import { CustomCakeRequestDetailPage } from '@/pages/custom-cakes/CustomCakeRequestDetailPage'
import { MenuPage } from '@/pages/menu/MenuPage'
import { SiteSectionsPage } from '@/pages/sections/SiteSectionsPage'
import { DeliveryAreasPage } from '@/pages/delivery-areas/DeliveryAreasPage'
import { JournalPage } from '@/pages/journal/JournalPage'
import { JournalPostEditorPage } from '@/pages/journal/JournalPostEditorPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'

export const router = createBrowserRouter([
  { path: '/signin', element: <SignIn /> },
  {
    element: <RequireAdmin />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate to="/orders" replace /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:orderId', element: <OrderDetailPage /> },
          { path: 'custom-cakes', element: <CustomCakeRequestsPage /> },
          { path: 'custom-cakes/:requestId', element: <CustomCakeRequestDetailPage /> },
          { path: 'menu', element: <MenuPage /> },
          { path: 'sections', element: <SiteSectionsPage /> },
          { path: 'journal', element: <JournalPage /> },
          { path: 'journal/:postId', element: <JournalPostEditorPage /> },
          { path: 'delivery-areas', element: <DeliveryAreasPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
