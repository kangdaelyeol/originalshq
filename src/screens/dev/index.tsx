import Styles from './style.module.scss'
import { useDev } from './use-dev'

export const Dev = () => {
  useDev()
  return <div className={Styles.main}>Hello</div>
}
