import { useCallback, useState } from 'react'
import {
  Footer,
  Header,
  ListArea,
  ListHeader,
  PaginationBar,
  Panel,
  SearchRow,
} from '@/screens/parke/components'
import { AccountBar } from '@/screens/parke/components/account-bar'
import { AdminManagerModal } from '@/screens/parke/components/admin-manager-modal'
import { AuthScreen } from '@/screens/parke/components/auth-screen'
import { DeleteConfirmModal } from '@/screens/parke/components/delete-confirm-modal'
import { DeletionLog } from '@/screens/parke/components/deletion-log'
import { Toasts } from '@/screens/parke/components/toasts'
import { ParkeContextProvider } from '@/screens/parke/context'
import { useAdminAuth } from '@/screens/parke/controller/use-admin-auth'
import Styles from '@/screens/parke/styles/global.module.scss'

/** /admin/parke — Parké QR(시리얼) 관리. 관리자 목록에 있는 Google 계정만
 * 들어온다. 데이터는 Parké Realtime Database(allow/, card/)를 직접 쓴다. */
export default function ParkeScreen() {
  const { state, error, signIn, signOut } = useAdminAuth()
  const [adminsOpen, setAdminsOpen] = useState(false)
  const closeAdmins = useCallback(() => setAdminsOpen(false), [])

  return (
    <div className={Styles.parke}>
      <div className={Styles.wrap}>
        <Header />
        {state.status !== 'admin' ? (
          <AuthScreen
            status={state.status}
            email={state.status === 'notAdmin' ? state.email : undefined}
            error={error}
            onSignIn={() => void signIn()}
            onSignOut={() => void signOut()}
          />
        ) : (
          // 계정이 바뀌면 목록·상태를 새로 시작한다.
          <ParkeContextProvider key={state.email} adminEmail={state.email}>
            <AccountBar
              email={state.email}
              onManageAdmins={() => setAdminsOpen(true)}
              onSignOut={() => void signOut()}
            />
            <Panel />
            <SearchRow />
            <ListHeader />
            <ListArea />
            <PaginationBar />
            <DeletionLog />
            <DeleteConfirmModal />
            <Toasts />
            {adminsOpen && (
              <AdminManagerModal myEmail={state.email} onClose={closeAdmins} />
            )}
          </ParkeContextProvider>
        )}
        <Footer />
      </div>
    </div>
  )
}
