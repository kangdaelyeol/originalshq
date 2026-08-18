import { type Device, type CreateLeadFormValues } from '../types'
import styles from '../styles/create-modal.module.scss'

interface CreateModalState {
  form: CreateLeadFormValues
  isSubmitting: boolean
}

interface CreateModalActions {
  closeCreateModal: () => void
  updateField: (field: keyof CreateLeadFormValues, value: string) => void
  handleCreateLeadClick: () => Promise<void>
}

interface CreateModalProps {
  state: CreateModalState
  actions: CreateModalActions
}

const DEVICE_OPTIONS: Device[] = [
  'F2Ultra',
  'F2UltraUV',
  'P3',
  'DTF',
  'Metalfab',
]

const FormRow = ({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) => (
  <div className={styles.formRow}>
    <label className={styles.formRow__label} htmlFor={htmlFor}>
      {label}
    </label>
    {children}
  </div>
)

export const CreateModal = ({ state, actions }: CreateModalProps) => {
  const { form, isSubmitting } = state
  const { closeCreateModal, updateField, handleCreateLeadClick } = actions

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h2 className={styles.title}>리드 수기 등록</h2>

        <p className={styles.sectionLabel}>연락처 정보</p>

        <FormRow label="이름 (fn)" htmlFor="lead-fn">
          <input
            id="lead-fn"
            className={styles.control}
            value={form.fn}
            onChange={(e) => updateField('fn', e.target.value)}
          />
        </FormRow>

        <FormRow label="전화번호 (ph)" htmlFor="lead-ph">
          <input
            id="lead-ph"
            className={styles.control}
            value={form.ph}
            onChange={(e) => updateField('ph', e.target.value)}
          />
        </FormRow>

        <FormRow label="기기 (device)" htmlFor="lead-device">
          <select
            id="lead-device"
            className={styles.control}
            value={form.device}
            onChange={(e) => updateField('device', e.target.value)}
          >
            {DEVICE_OPTIONS.map((device) => (
              <option key={device} value={device}>
                {device}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow label="utm_campaign" htmlFor="lead-utm-campaign">
          <input
            id="lead-utm-campaign"
            className={styles.control}
            value={form.utm_campaign}
            onChange={(e) => updateField('utm_campaign', e.target.value)}
          />
        </FormRow>

        <FormRow label="utm_medium" htmlFor="lead-utm-medium">
          <input
            id="lead-utm-medium"
            className={styles.control}
            value={form.utm_medium}
            onChange={(e) => updateField('utm_medium', e.target.value)}
          />
        </FormRow>

        <FormRow label="utm_source" htmlFor="lead-utm-source">
          <input
            id="lead-utm-source"
            className={styles.control}
            value={form.utm_source}
            onChange={(e) => updateField('utm_source', e.target.value)}
          />
        </FormRow>

        <FormRow label="ip" htmlFor="lead-ip">
          <input
            id="lead-ip"
            className={styles.control}
            value={form.ip}
            onChange={(e) => updateField('ip', e.target.value)}
          />
        </FormRow>

        <FormRow label="fbc" htmlFor="lead-fbc">
          <input
            id="lead-fbc"
            className={styles.control}
            value={form.fbc}
            onChange={(e) => updateField('fbc', e.target.value)}
          />
        </FormRow>

        <FormRow label="fbp" htmlFor="lead-fbp">
          <input
            id="lead-fbp"
            className={styles.control}
            value={form.fbp}
            onChange={(e) => updateField('fbp', e.target.value)}
          />
        </FormRow>

        <FormRow label="user_agent" htmlFor="lead-user-agent">
          <input
            id="lead-user-agent"
            className={styles.control}
            value={form.user_agent}
            onChange={(e) => updateField('user_agent', e.target.value)}
          />
        </FormRow>

        <FormRow label="생성일시 (createdAt)" htmlFor="lead-created-at">
          <input
            id="lead-created-at"
            type="datetime-local"
            className={styles.control}
            value={form.createdAt}
            onChange={(e) => updateField('createdAt', e.target.value)}
          />
        </FormRow>

        <div className={styles.footer}>
          <button
            className={`${styles.btn} ${styles['btn--ghost']}`}
            onClick={closeCreateModal}
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            className={`${styles.btn} ${styles['btn--primary']}`}
            onClick={handleCreateLeadClick}
            disabled={isSubmitting}
          >
            {isSubmitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
